import { geoEdgeEqual } from '../geo';
import { utilArrayIntersection } from '../util';


export const actionAddMidpoint = (midpoint, node) => {
    return (graph) => {
        graph = graph.replace(node.move(midpoint.loc));

        let parents = utilArrayIntersection(
            graph.parentWays(graph.entity(midpoint.edge[0])),
            graph.parentWays(graph.entity(midpoint.edge[1]))
        );

        parents.forEach((way) => {
            for (var i = 0; i < way.nodes.length - 1; i++) {
                if (geoEdgeEqual([way.nodes[i], way.nodes[i + 1]], midpoint.edge)) {
                    graph = graph.replace(graph.entity(way.id).addNode(node.id, i + 1));

                    // Add only one midpoint on doubled-back segments,
                    // turning them into self-intersections.
                    return;
                }
            }
        });

        return graph;
    };
};
