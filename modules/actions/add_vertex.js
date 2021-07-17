// https://github.com/openstreetmap/potlatch2/blob/master/net/systemeD/halcyon/connection/actions/AddNodeToWayAction.as
export const actionAddVertex = (wayId, nodeId, index) => {
    return (graph) => {
        return graph.replace(graph.entity(wayId).addNode(nodeId, index));
    };
};
