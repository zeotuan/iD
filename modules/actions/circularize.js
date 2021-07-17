import { median as d3_median } from 'd3-array';

import {
    polygonArea as d3_polygonArea,
    polygonHull as d3_polygonHull,
    polygonCentroid as d3_polygonCentroid
} from 'd3-polygon';

import { geoVecInterp, geoVecLength } from '../geo';
import { osmNode } from '../osm/node';
import { utilArrayUniq } from '../util';
import { geoVecLengthSquare } from '../geo/vector';


export function actionCircularize(wayId, projection, maxAngle) {
    maxAngle = (maxAngle || 20) * Math.PI / 180;


    let action = function(graph, t) {
        if (t === null || !isFinite(t)) t = 1;
        t = Math.min(Math.max(+t, 0), 1);

        let way = graph.entity(wayId);
        let origNodes = {};

        graph.childNodes(way).forEach(function(node) {
            if (!origNodes[node.id]) origNodes[node.id] = node;
        });

        if (!way.isConvex(graph)) {
            graph = action.makeConvex(graph);
        }

        let nodes = utilArrayUniq(graph.childNodes(way));
        let keyNodes = nodes.filter(function(n) { return graph.parentWays(n).length !== 1; });
        let points = nodes.map(function(n) { return projection(n.loc); });
        let keyPoints = keyNodes.map(function(n) { return projection(n.loc); });
        let centroid = (points.length === 2) ? geoVecInterp(points[0], points[1], 0.5) : d3_polygonCentroid(points);
        let radius = d3_median(points, function(p) { return geoVecLength(centroid, p); });
        let sign = d3_polygonArea(points) > 0 ? 1 : -1;
        let ids, i, j, k;

        // we need at least two key nodes for the algorithm to work
        if (!keyNodes.length) {
            keyNodes = [nodes[0]];
            keyPoints = [points[0]];
        }

        if (keyNodes.length === 1) {
            let index = nodes.indexOf(keyNodes[0]);
            let oppositeIndex = Math.floor((index + nodes.length / 2) % nodes.length);

            keyNodes.push(nodes[oppositeIndex]);
            keyPoints.push(points[oppositeIndex]);
        }

        // key points and nodes are those connected to the ways,
        // they are projected onto the circle, in between nodes are moved
        // to constant intervals between key nodes, extra in between nodes are
        // added if necessary.
        for (i = 0; i < keyPoints.length; i++) {
            let nextKeyNodeIndex = (i + 1) % keyNodes.length;
            let startNode = keyNodes[i];
            let endNode = keyNodes[nextKeyNodeIndex];
            let startNodeIndex = nodes.indexOf(startNode);
            let endNodeIndex = nodes.indexOf(endNode);
            let numberNewPoints = -1;
            let indexRange = endNodeIndex - startNodeIndex;
            let nearNodes = {};
            let inBetweenNodes = [];
            let startAngle, endAngle, totalAngle, eachAngle;
            let angle, loc, node, origNode;

            if (indexRange < 0) {
                indexRange += nodes.length;
            }

            // position this key node
            let distance = geoVecLength(centroid, keyPoints[i]) || 1e-4;
            keyPoints[i] = [
                centroid[0] + (keyPoints[i][0] - centroid[0]) / distance * radius,
                centroid[1] + (keyPoints[i][1] - centroid[1]) / distance * radius
            ];
            loc = projection.invert(keyPoints[i]);
            node = keyNodes[i];
            origNode = origNodes[node.id];
            node = node.move(geoVecInterp(origNode.loc, loc, t));
            graph = graph.replace(node);

            // figure out the between delta angle we want to match to
            startAngle = Math.atan2(keyPoints[i][1] - centroid[1], keyPoints[i][0] - centroid[0]);
            endAngle = Math.atan2(keyPoints[nextKeyNodeIndex][1] - centroid[1], keyPoints[nextKeyNodeIndex][0] - centroid[0]);
            totalAngle = endAngle - startAngle;

            // detects looping around -pi/pi
            if (totalAngle * sign > 0) {
                totalAngle = -sign * (2 * Math.PI - Math.abs(totalAngle));
            }

            do {
                numberNewPoints++;
                eachAngle = totalAngle / (indexRange + numberNewPoints);
            } while (Math.abs(eachAngle) > maxAngle);


            // move existing nodes
            for (j = 1; j < indexRange; j++) {
                angle = startAngle + j * eachAngle;
                loc = projection.invert([
                    centroid[0] + Math.cos(angle) * radius,
                    centroid[1] + Math.sin(angle) * radius
                ]);

                node = nodes[(j + startNodeIndex) % nodes.length];
                origNode = origNodes[node.id];
                nearNodes[node.id] = angle;

                node = node.move(geoVecInterp(origNode.loc, loc, t));
                graph = graph.replace(node);
            }

            // add new in between nodes if necessary
            for (j = 0; j < numberNewPoints; j++) {
                angle = startAngle + (indexRange + j) * eachAngle;
                loc = projection.invert([
                    centroid[0] + Math.cos(angle) * radius,
                    centroid[1] + Math.sin(angle) * radius
                ]);

                // choose a nearnode to use as the original
                let min = Infinity;
                for (let nodeId in nearNodes) {
                    let nearAngle = nearNodes[nodeId];
                    let dist = Math.abs(nearAngle - angle);
                    if (dist < min) {
                        min = dist;
                        origNode = origNodes[nodeId];
                    }
                }

                node = osmNode({ loc: geoVecInterp(origNode.loc, loc, t) });
                graph = graph.replace(node);

                nodes.splice(endNodeIndex + j, 0, node);
                inBetweenNodes.push(node.id);
            }

            // Check for other ways that share these keyNodes..
            // If keyNodes are adjacent in both ways,
            // we can add inBetweenNodes to that shared way too..
            if (indexRange === 1 && inBetweenNodes.length) {
                let startIndex1 = way.nodes.lastIndexOf(startNode.id);
                let endIndex1 = way.nodes.lastIndexOf(endNode.id);
                let wayDirection1 = (endIndex1 - startIndex1);
                if (wayDirection1 < -1) { wayDirection1 = 1; }

                let parentWays = graph.parentWays(keyNodes[i]);
                for (j = 0; j < parentWays.length; j++) {
                    let sharedWay = parentWays[j];
                    if (sharedWay === way) continue;

                    if (sharedWay.areAdjacent(startNode.id, endNode.id)) {
                        let startIndex2 = sharedWay.nodes.lastIndexOf(startNode.id);
                        let endIndex2 = sharedWay.nodes.lastIndexOf(endNode.id);
                        let wayDirection2 = (endIndex2 - startIndex2);
                        let insertAt = endIndex2;
                        if (wayDirection2 < -1) { wayDirection2 = 1; }

                        if (wayDirection1 !== wayDirection2) {
                            inBetweenNodes.reverse();
                            insertAt = startIndex2;
                        }
                        for (k = 0; k < inBetweenNodes.length; k++) {
                            sharedWay = sharedWay.addNode(inBetweenNodes[k], insertAt + k);
                        }
                        graph = graph.replace(sharedWay);
                    }
                }
            }

        }

        // update the way to have all the new nodes
        ids = nodes.map(function(n) { return n.id; });
        ids.push(ids[0]);

        way = way.update({nodes: ids});
        graph = graph.replace(way);

        return graph;
    };


    action.makeConvex = function(graph) {
        let way = graph.entity(wayId);
        let nodes = utilArrayUniq(graph.childNodes(way));
        let points = nodes.map(function(n) { return projection(n.loc); });
        let sign = d3_polygonArea(points) > 0 ? 1 : -1;
        let hull = d3_polygonHull(points);
        let i, j;

        // D3 convex hulls go counterclockwise..
        if (sign === -1) {
            nodes.reverse();
            points.reverse();
        }

        for (i = 0; i < hull.length - 1; i++) {
            let startIndex = points.indexOf(hull[i]);
            let endIndex = points.indexOf(hull[i+1]);
            let indexRange = (endIndex - startIndex);

            if (indexRange < 0) {
                indexRange += nodes.length;
            }

            // move interior nodes to the surface of the convex hull..
            for (j = 1; j < indexRange; j++) {
                let point = geoVecInterp(hull[i], hull[i+1], j / indexRange);
                let node = nodes[(j + startIndex) % nodes.length].move(projection.invert(point));
                graph = graph.replace(node);
            }
        }
        return graph;
    };


    action.disabled = function(graph) {
        if (!graph.entity(wayId).isClosed()) {
            return 'not_closed';
        }

        //disable when already circular
        let way = graph.entity(wayId);
        let nodes = utilArrayUniq(graph.childNodes(way));
        let points = nodes.map(function(n) { return projection(n.loc); });
        let hull = d3_polygonHull(points);
        let epsilonAngle =  Math.PI / 180;
        if (hull.length !== points.length || hull.length < 3){
            return false;
        }
        let centroid = d3_polygonCentroid(points);
        let radius = geoVecLengthSquare(centroid, points[0]);

        let i, actualPoint;

        // compare distances between centroid and points
        for (i = 0; i < hull.length; i++){
            actualPoint = hull[i];
            let actualDist = geoVecLengthSquare(actualPoint, centroid);
            let diff = Math.abs(actualDist - radius);
            //compare distances with epsilon-error (5%)
            if (diff > 0.05*radius) {
                return false;
            }
        }

        //check if central angles are smaller than maxAngle
        for (i = 0; i < hull.length; i++){
            actualPoint = hull[i];
            let nextPoint = hull[(i+1)%hull.length];
            let startAngle = Math.atan2(actualPoint[1] - centroid[1], actualPoint[0] - centroid[0]);
            let endAngle = Math.atan2(nextPoint[1] - centroid[1], nextPoint[0] - centroid[0]);
            let angle = endAngle - startAngle;
            if (angle < 0) {
                angle = -angle;
            }
            if (angle > Math.PI){
                angle = (2*Math.PI - angle);
            }

            if (angle > maxAngle + epsilonAngle) {
                return false;
            }
        }
        return 'already_circular';
    };


    action.transitionable = true;


    return action;
}
