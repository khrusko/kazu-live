#!/usr/bin/env python3
"""Put county stops on the road the official line map follows.

Karlovac GIS stops stay put. Other stops take the OpenStreetMap settlement
with the same name when that settlement sits on the line between the
neighbouring stops. Stops that share one settlement (Krnjak I–III, and so on)
are then spaced along the driving route by the timetable kilometres.
"""

import json
import math
import re
import sys
import time
import unicodedata
import urllib.request
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
NETWORK = ROOT / "data" / "network.json"
OSM = Path("/tmp/osm-places.json")
DRY = "--dry-run" in sys.argv
ANCHORS_ONLY = "--anchors-only" in sys.argv

ROMAN = re.compile(r"\b(i{1,3}|iv|vi{0,3}|ix|x)\b")


def fold(value):
    text = value.lower().replace("đ", "d").replace("Đ", "d")
    text = unicodedata.normalize("NFD", text)
    text = "".join(char for char in text if unicodedata.category(char) != "Mn")
    text = re.sub(r"[^a-z0-9]+", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def variants(name):
    base = fold(name)
    without_paren = fold(re.sub(r"\(.*?\)", " ", name))
    without_roman = re.sub(r"\s+", " ", ROMAN.sub(" ", without_paren)).strip()
    found = []
    for item in (base, without_paren, without_roman):
        if item and item not in found:
            found.append(item)
    return found


def hav(a, b):
    radius = 6371.0
    lat1, lat2 = math.radians(a[0]), math.radians(b[0])
    dlat = math.radians(b[0] - a[0])
    dlng = math.radians(b[1] - a[1])
    h = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlng / 2) ** 2
    return 2 * radius * math.asin(min(1, math.sqrt(h)))


def segment_km(point, start, end):
    if start is None and end is None:
        return 0
    if start is None:
        return hav(point, end)
    if end is None:
        return hav(point, start)
    mean = math.radians(point[0])
    scale_x = 111.32 * math.cos(mean)
    scale_y = 110.57

    def xy(coord):
        return ((coord[1] - point[1]) * scale_x, (coord[0] - point[0]) * scale_y)

    px, py = 0, 0
    ax, ay = xy(start)
    bx, by = xy(end)
    dx, dy = bx - ax, by - ay
    length = dx * dx + dy * dy
    if length == 0:
        return hav(point, start)
    t = max(0, min(1, ((px - ax) * dx + (py - ay) * dy) / length))
    proj = (start[0] + (end[0] - start[0]) * t, start[1] + (end[1] - start[1]) * t)
    return hav(point, proj)


def point_at(points, start, end, fraction):
    if end <= start:
        return points[start]
    lengths = []
    total = 0
    for index in range(start + 1, end + 1):
        distance = hav(points[index - 1], points[index])
        lengths.append(distance)
        total += distance
    if total == 0:
        return points[start]
    remain = total * min(1, max(0, fraction))
    for index, distance in enumerate(lengths):
        if remain <= distance:
            t = 0 if distance == 0 else remain / distance
            a = points[start + index]
            b = points[start + index + 1]
            return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]
        remain -= distance
    return points[end]


def osrm(coords):
    if len(coords) < 2:
        return {"points": coords[:], "snapped": coords[:]}
    path = ";".join(f"{coord[1]:.6f},{coord[0]:.6f}" for coord in coords)
    last = "fail"
    for radius in (800, 2500, None):
        radius_query = "" if radius is None else "&radiuses=" + ";".join(str(radius) for _ in coords)
        url = (
            "https://router.project-osrm.org/route/v1/driving/"
            f"{path}?overview=full&geometries=geojson&steps=false{radius_query}"
        )
        request = urllib.request.Request(url, headers={"User-Agent": "SizelRouteBot/1.0"})
        try:
            with urllib.request.urlopen(request, timeout=40) as response:
                data = json.load(response)
        except Exception as error:  # noqa: BLE001 - keep going with the next radius
            last = str(error)
            time.sleep(1.5)
            continue
        if data.get("code") != "Ok":
            last = data.get("code") or "no route"
            continue
        points = [[lat, lng] for lng, lat in data["routes"][0]["geometry"]["coordinates"]]
        snapped = [[item["location"][1], item["location"][0]] for item in data["waypoints"]]
        distance = data["routes"][0]["distance"] / 1000
        return {"points": points, "snapped": snapped, "km": distance}
    if len(coords) > 8:
        mid = len(coords) // 2
        left = osrm(coords[: mid + 1])
        time.sleep(0.3)
        right = osrm(coords[mid:])
        return {
            "points": left["points"] + right["points"][1:],
            "snapped": left["snapped"] + right["snapped"][1:],
            "km": left.get("km", 0) + right.get("km", 0),
        }
    raise RuntimeError(last)


def nearest_index(points, waypoint, cursor):
    best = cursor
    best_d = 1e18
    for index in range(cursor, len(points)):
        distance = hav(points[index], waypoint)
        if distance < best_d:
            best_d = distance
            best = index
    return best


def load_osm():
    index = defaultdict(list)
    for element in json.loads(OSM.read_text())["elements"]:
        tags = element.get("tags") or {}
        name = tags.get("name")
        if not name or "lat" not in element:
            continue
        kind = tags.get("place") or tags.get("highway")
        if kind not in {"city", "town", "village", "hamlet", "suburb", "neighbourhood", "locality", "bus_stop"}:
            continue
        index[fold(name)].append(
            {"lat": element["lat"], "lng": element["lon"], "kind": kind, "name": name}
        )
    return index


def current_coord(stop):
    return (stop["lat"], stop["lng"])


def outer_ends(direction, index, stops):
    here = current_coord(stops[direction["stops"][index]["stopId"]])
    previous = following = None
    for cursor in range(index - 1, -1, -1):
        other = current_coord(stops[direction["stops"][cursor]["stopId"]])
        if hav(other, here) > 0.35:
            previous = other
            break
    for cursor in range(index + 1, len(direction["stops"])):
        other = current_coord(stops[direction["stops"][cursor]["stopId"]])
        if hav(other, here) > 0.35:
            following = other
            break
    return previous, following


def reference(previous, following, here):
    if previous and following:
        return ((previous[0] + following[0]) / 2, (previous[1] + following[1]) / 2)
    return previous or following or here


def repair_detours(network, stops):
    """Project stops that pull the bus onto a long detour back onto the road."""
    directions = [direction for line in network["lines"] for direction in line["directions"]]
    proposals = defaultdict(list)

    def droppable(stop_id):
        stop = stops[stop_id]
        return stop["precision"] != "gis" and not fold(stop["name"]).startswith("ak ")

    for number, direction in enumerate(directions, start=1):
        calls = direction["stops"]
        rising = sum(1 for index in range(len(calls) - 1) if calls[index + 1]["km"] > calls[index]["km"] + 0.05)
        if rising < max(2, len(calls) * 0.4):
            continue
        kept = set(range(len(calls)))
        routed = None
        groups = []
        dropped_any = False
        for _ in range(10):
            groups = []
            for index in sorted(kept):
                stop = stops[calls[index]["stopId"]]
                point = (round(stop["lat"], 5), round(stop["lng"], 5))
                if groups and groups[-1]["point"] == point:
                    groups[-1]["indexes"].append(index)
                else:
                    groups.append({"point": point, "indexes": [index], "latlng": [stop["lat"], stop["lng"]]})
            if len(groups) < 2:
                break
            leg_km = leg_distances([group["latlng"] for group in groups])
            time.sleep(0.12)
            if not leg_km:
                break
            victim = None
            worst_extra = 0
            for leg_index, road in enumerate(leg_km):
                start_km = calls[groups[leg_index]["indexes"][-1]]["km"]
                end_km = calls[groups[leg_index + 1]["indexes"][0]]["km"]
                if end_km + 0.05 < start_km:
                    continue
                timetable = max(0.2, end_km - start_km)
                extra = road - (timetable * 2.3 + 2.5)
                if extra <= worst_extra:
                    continue
                for candidate in (leg_index + 1, leg_index):
                    indexes = groups[candidate]["indexes"]
                    terminus = any(index in (0, len(calls) - 1) for index in indexes)
                    if (
                        not terminus
                        and all(droppable(calls[index]["stopId"]) for index in indexes)
                        and len(kept) - len(indexes) >= 2
                    ):
                        victim = indexes
                        worst_extra = extra
                        break
            if not victim:
                break
            for index in victim:
                kept.discard(index)
            dropped_any = True
            names = ", ".join(stops[calls[index]["stopId"]]["name"] for index in victim[:3])
            print(f"repair {direction['id']} drop {names}")
        if not dropped_any:
            continue
        groups = []
        for index in sorted(kept):
            stop = stops[calls[index]["stopId"]]
            point = (round(stop["lat"], 5), round(stop["lng"], 5))
            if groups and groups[-1]["point"] == point:
                groups[-1]["indexes"].append(index)
            else:
                groups.append({"point": point, "indexes": [index], "latlng": [stop["lat"], stop["lng"]]})
        if len(groups) < 2:
            continue
        try:
            routed = osrm([group["latlng"] for group in groups])
        except Exception as error:  # noqa: BLE001
            print(f"repair {direction['id']} fail {error}")
            continue
        cursor = 0
        shape_index = []
        for snap in routed["snapped"]:
            cursor = nearest_index(routed["points"], snap, cursor)
            shape_index.append(cursor)
        located = {}
        for group_index, group in enumerate(groups):
            for index in group["indexes"]:
                stop = stops[calls[index]["stopId"]]
                if stop["precision"] == "gis":
                    located[index] = [stop["lat"], stop["lng"]]
                else:
                    located[index] = routed["points"][shape_index[group_index]]
        for index, call in enumerate(calls):
            if index in located:
                continue
            anchored = {item for group in groups for item in group["indexes"]}
            before = [item for item in sorted(anchored) if item < index]
            after = [item for item in sorted(anchored) if item > index]
            if not before or not after:
                continue
            left, right = before[-1], after[0]
            left_km = calls[left]["km"]
            right_km = calls[right]["km"]
            if right_km <= left_km or hav(located[left], located[right]) < 0.25:
                point = located[left]
            else:
                fraction = (call["km"] - left_km) / (right_km - left_km)
                left_shape = next(shape_index[n] for n, group in enumerate(groups) if left in group["indexes"])
                right_shape = next(shape_index[n] for n, group in enumerate(groups) if right in group["indexes"])
                point = point_at(routed["points"], min(left_shape, right_shape), max(left_shape, right_shape), fraction)
            located[index] = point
            proposals[call["stopId"]].append(point)
        time.sleep(0.1)
        print(f"repair {number:02d}/{len(directions)} {direction['id']} kept {len(groups)}")

    changed = 0
    for stop_id, points in proposals.items():
        stop = stops[stop_id]
        lat = sum(point[0] for point in points) / len(points)
        lng = sum(point[1] for point in points) / len(points)
        if hav((lat, lng), (stop["lat"], stop["lng"])) < 0.05:
            continue
        stop["lat"] = round(lat, 6)
        stop["lng"] = round(lng, 6)
        stop["precision"] = "road"
        changed += 1
    for line in network["lines"]:
        for direction in line["directions"]:
            direction["geometry"] = [
                [round(stops[call["stopId"]]["lat"], 6), round(stops[call["stopId"]]["lng"], 6)]
                for call in direction["stops"]
            ]
    print(f"repair moved {changed}")
    return changed


def leg_distances(coords):
    if len(coords) < 2:
        return []
    path = ";".join(f"{coord[1]:.6f},{coord[0]:.6f}" for coord in coords)
    url = f"https://router.project-osrm.org/route/v1/driving/{path}?overview=false&steps=false"
    request = urllib.request.Request(url, headers={"User-Agent": "SizelRouteBot/1.0"})
    try:
        with urllib.request.urlopen(request, timeout=40) as response:
            data = json.load(response)
    except Exception:  # noqa: BLE001
        return []
    if data.get("code") != "Ok":
        return []
    return [leg["distance"] / 1000 for leg in data["routes"][0]["legs"]]


def main():
    network = json.loads(NETWORK.read_text())
    stops = {stop["id"]: stop for stop in network["stops"]}
    places = load_osm()

    # The return of A2 misspells the Karlovac GIS stop.
    for line in network["lines"]:
        for direction in line["directions"]:
            for call in direction["stops"]:
                if call["stopId"] == "domobroanska":
                    call["stopId"] = "domobranska"
    network["stops"] = [stop for stop in network["stops"] if stop["id"] != "domobroanska"]
    stops = {stop["id"]: stop for stop in network["stops"]}

    occurrences = defaultdict(list)
    for line in network["lines"]:
        for direction in line["directions"]:
            for call_index, call in enumerate(direction["stops"]):
                previous, following = outer_ends(direction, call_index, stops)
                here = current_coord(stops[call["stopId"]])
                # A terminus (first or last stop) is one place even when the
                # lines leave it in different directions. Only a stop that sits
                # in the middle of two far-apart corridors is two villages.
                if previous is None or following is None:
                    continue
                occurrences[call["stopId"]].append(
                    {
                        "direction": direction,
                        "index": call_index,
                        "previous": previous,
                        "following": following,
                        "reference": reference(previous, following, here),
                    }
                )

    split_count = 0
    for stop_id, items in list(occurrences.items()):
        stop = stops[stop_id]
        if stop["precision"] == "gis" or len(items) < 2:
            continue
        clusters = []
        for item in items:
            placed = False
            for cluster in clusters:
                if hav(cluster[0]["reference"], item["reference"]) <= 18:
                    cluster.append(item)
                    placed = True
                    break
            if not placed:
                clusters.append([item])
        if len(clusters) < 2:
            continue
        clusters.sort(key=len, reverse=True)
        for cluster_number, cluster in enumerate(clusters[1:], start=2):
            new_id = f"{stop_id}--{cluster_number}"
            while new_id in stops:
                cluster_number += 1
                new_id = f"{stop_id}--{cluster_number}"
            neighbour = cluster[0]["following"] or cluster[0]["previous"]
            suffix = ""
            # Two villages share the printed name. Add the neighbouring stop
            # so the search box can tell them apart.
            if neighbour:
                nearest = None
                for other in network["stops"]:
                    if other["id"] == stop_id:
                        continue
                    distance = hav(current_coord(other), neighbour)
                    if nearest is None or distance < nearest[0]:
                        nearest = (distance, other["name"])
                if nearest and nearest[0] < 1.5:
                    suffix = nearest[1]
            copy = {
                "id": new_id,
                "name": f"{stop['name']} ({suffix})" if suffix else stop["name"],
                "lat": stop["lat"],
                "lng": stop["lng"],
                "precision": stop["precision"],
            }
            network["stops"].append(copy)
            stops[new_id] = copy
            for item in cluster:
                item["direction"]["stops"][item["index"]]["stopId"] = new_id
            split_count += 1
            print(f"split {stop['name']} -> {copy['name']}")

    occurrences = defaultdict(list)
    for line in network["lines"]:
        for direction in line["directions"]:
            for index, call in enumerate(direction["stops"]):
                previous, following = outer_ends(direction, index, stops)
                occurrences[call["stopId"]].append((previous, following))

    anchors = {}
    moved = 0
    for stop in network["stops"]:
        if stop["precision"] == "gis" or fold(stop["name"]).startswith("ak "):
            anchors[stop["id"]] = (stop["lat"], stop["lng"], "keep")
            continue
        here = (stop["lat"], stop["lng"])
        segments = occurrences.get(stop["id"]) or [(None, None)]
        coord_key = (round(stop["lat"], 4), round(stop["lng"], 4))
        piled = sum(
            1
            for other in network["stops"]
            if (round(other["lat"], 4), round(other["lng"], 4)) == coord_key
        ) >= 3
        best = None
        match_name = stop["name"].split(" (")[0] if "--" in stop["id"] else stop["name"]
        name_variants = variants(match_name)
        for rank, variant in enumerate(name_variants):
            paren_only = "(" in match_name and variant != name_variants[0]
            for place in places.get(variant, []):
                point = (place["lat"], place["lng"])
                on_line = min(segment_km(point, previous, following) for previous, following in segments)
                near_current = hav(point, here)
                if on_line > 12 and near_current > 6:
                    continue
                # "Ogulin (Galge)" must not jump to the Ogulin town centre.
                # A parenthetical stop may use the bare settlement only when it
                # is already piled on that settlement or the correction is small.
                if paren_only and not piled and near_current > 1.2:
                    continue
                kind_rank = {"village": 0, "town": 0, "city": 0, "hamlet": 1, "suburb": 1, "bus_stop": 2}.get(place["kind"], 3)
                score = (on_line, rank, kind_rank, near_current)
                if best is None or score < best[0]:
                    best = (score, point, place["name"], on_line, near_current)
        if best is None:
            shared = False
            for previous, following in segments:
                # A stop piled on its neighbour keeps no anchor of its own,
                # so the route is not pulled back to that shared town.
                if previous is None and following is None:
                    shared = True
            # outer_ends returns None,None only when every other stop on the
            # direction is within 350 m. Treat a stop as piled when its own
            # coordinate is shared.
            coord_key = (round(stop["lat"], 4), round(stop["lng"], 4))
            fellows = [
                other["id"]
                for other in network["stops"]
                if (round(other["lat"], 4), round(other["lng"], 4)) == coord_key
            ]
            if len(fellows) >= 3:
                anchors[stop["id"]] = None
                continue
            anchors[stop["id"]] = (stop["lat"], stop["lng"], "keep")
            continue
        anchors[stop["id"]] = (best[1][0], best[1][1], "osm")
        if best[4] > 0.8:
            moved += 1
            print(
                f"anchor {stop['name']:32} {best[4]:5.1f} km -> {best[2]:22} "
                f"{best[1][0]:.4f},{best[1][1]:.4f} line {best[3]:.1f}"
            )

    print(f"splits {split_count} anchors moved {moved}")
    if ANCHORS_ONLY:
        return

    proposals = defaultdict(list)
    directions = [direction for line in network["lines"] for direction in line["directions"]]
    for number, direction in enumerate(directions, start=1):
        groups = []
        for index, call in enumerate(direction["stops"]):
            anchor = anchors.get(call["stopId"])
            if anchor is None:
                continue
            coord = (round(anchor[0], 5), round(anchor[1], 5))
            if groups and groups[-1]["coord"] == coord:
                groups[-1]["indexes"].append(index)
            else:
                groups.append({"coord": coord, "indexes": [index], "point": [anchor[0], anchor[1]]})
        placed = {}
        try:
            if len(groups) >= 2:
                routed = osrm([group["point"] for group in groups])
                cursor = 0
                shape_index = []
                for snap in routed["snapped"]:
                    cursor = nearest_index(routed["points"], snap, cursor)
                    shape_index.append(cursor)
                for group_index, group in enumerate(groups):
                    here = shape_index[group_index]
                    if len(group["indexes"]) == 1:
                        call = direction["stops"][group["indexes"][0]]
                        stop = stops[call["stopId"]]
                        if stop["precision"] == "gis":
                            placed[group["indexes"][0]] = [stop["lat"], stop["lng"]]
                        else:
                            placed[group["indexes"][0]] = routed["points"][here]
                        continue
                    previous = group_index - 1 if group_index else None
                    following = group_index + 1 if group_index < len(groups) - 1 else None
                    if previous is not None and following is not None:
                        start, end = shape_index[previous], shape_index[following]
                        start_km = direction["stops"][groups[previous]["indexes"][-1]]["km"]
                        end_km = direction["stops"][groups[following]["indexes"][0]]["km"]
                    elif following is not None:
                        start, end = here, shape_index[following]
                        start_km = direction["stops"][group["indexes"][0]]["km"]
                        end_km = direction["stops"][groups[following]["indexes"][0]]["km"]
                    elif previous is not None:
                        start, end = shape_index[previous], here
                        start_km = direction["stops"][groups[previous]["indexes"][-1]]["km"]
                        end_km = direction["stops"][group["indexes"][-1]]["km"]
                    else:
                        start = end = here
                        start_km = end_km = 0
                    span = end_km - start_km
                    for stop_index in group["indexes"]:
                        km = direction["stops"][stop_index]["km"]
                        fraction = 0 if span == 0 else (km - start_km) / span
                        placed[stop_index] = point_at(routed["points"], min(start, end), max(start, end), fraction)
                known = sorted(placed)
                for index, call in enumerate(direction["stops"]):
                    if index in placed:
                        continue
                    before = [item for item in known if item < index]
                    after = [item for item in known if item > index]
                    if before and after:
                        left, right = before[-1], after[0]
                        left_km = direction["stops"][left]["km"]
                        right_km = direction["stops"][right]["km"]
                        # Same settlement on both sides: keep the stop there.
                        if hav(placed[left], placed[right]) < 0.4 or right_km <= left_km:
                            placed[index] = placed[left]
                        else:
                            fraction = (call["km"] - left_km) / (right_km - left_km)
                            # Walk the shape between the two anchored stops.
                            left_shape = next(shape_index[n] for n, group in enumerate(groups) if left in group["indexes"])
                            right_shape = next(shape_index[n] for n, group in enumerate(groups) if right in group["indexes"])
                            placed[index] = point_at(
                                routed["points"], min(left_shape, right_shape), max(left_shape, right_shape), fraction
                            )
                    elif before:
                        placed[index] = placed[before[-1]]
                    elif after:
                        placed[index] = placed[after[0]]
                official = direction["stops"][-1]["km"] - direction["stops"][0]["km"]
                print(
                    f"{number:02d}/{len(directions)} {direction['id']:8} road {routed.get('km', 0):6.1f} km  timetable {official:6.1f}"
                )
            else:
                print(f"{number:02d}/{len(directions)} {direction['id']:8} too few anchors")
        except Exception as error:  # noqa: BLE001 - one bad direction should not drop the rest
            print(f"{number:02d}/{len(directions)} {direction['id']:8} ROUTE FAIL {error}")
        for index, call in enumerate(direction["stops"]):
            point = placed.get(index)
            if point is None:
                anchor = anchors.get(call["stopId"])
                if anchor is None:
                    continue
                point = [anchor[0], anchor[1]]
            proposals[call["stopId"]].append(point)
        time.sleep(0.15)

    changed = 0
    for stop in network["stops"]:
        if stop["precision"] == "gis" or fold(stop["name"]).startswith("ak "):
            continue
        points = proposals.get(stop["id"])
        if not points:
            anchor = anchors.get(stop["id"])
            if anchor is None:
                continue
            points = [[anchor[0], anchor[1]]]
        lat = sum(point[0] for point in points) / len(points)
        lng = sum(point[1] for point in points) / len(points)
        if hav((lat, lng), (stop["lat"], stop["lng"])) < 0.04:
            continue
        if hav((lat, lng), (stop["lat"], stop["lng"])) > 45:
            print(f"skip far {stop['name']}")
            continue
        stop["lat"] = round(lat, 6)
        stop["lng"] = round(lng, 6)
        stop["precision"] = "road"
        changed += 1

    for line in network["lines"]:
        for direction in line["directions"]:
            direction["geometry"] = [
                [round(stops[call["stopId"]]["lat"], 6), round(stops[call["stopId"]]["lng"], 6)]
                for call in direction["stops"]
            ]

    network["updatedAt"] = "2026-10-18T13:40:00+02:00"
    network["note"] = (
        "Polasci su preuzeti sa službenih rasporeda. Koordinate stajališta na području Karlovca "
        "preuzete su s GIS-a Grada Karlovca. Ostala stajališta postavljena su uz cestu službene linije."
    )
    print(f"stops moved onto the road {changed}")
    if DRY:
        print("dry run, network.json unchanged")
        return
    NETWORK.write_text(json.dumps(network, ensure_ascii=False, separators=(",", ":")))
    print("wrote", NETWORK)


if __name__ == "__main__":
    if "--repair" in sys.argv:
        network = json.loads(NETWORK.read_text())
        stops = {stop["id"]: stop for stop in network["stops"]}
        repair_detours(network, stops)
        if DRY:
            print("dry run, network.json unchanged")
        else:
            NETWORK.write_text(json.dumps(network, ensure_ascii=False, separators=(",", ":")))
            print("wrote", NETWORK)
    else:
        main()
