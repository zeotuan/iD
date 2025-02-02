import { actionDeleteRelation } from './delete_relation';
import { actionDeleteWay } from './delete_way';


// https://github.com/openstreetmap/potlatch2/blob/master/net/systemeD/halcyon/connection/actions/DeleteNodeAction.as
export const actionDeleteNode = (nodeId) => {
    let action = function(graph) {
        let node = graph.entity(nodeId);

        graph.parentWays(node)
            .forEach((parent) => {
                parent = parent.removeNode(nodeId);
                graph = graph.replace(parent);

                if (parent.isDegenerate()) {
                    graph = actionDeleteWay(parent.id)(graph);
                }
            });

        graph.parentRelations(node)
            .forEach((parent) => {
                parent = parent.removeMembersWithID(nodeId);
                graph = graph.replace(parent);

                if (parent.isDegenerate()) {
                    graph = actionDeleteRelation(parent.id)(graph);
                }
            });

        return graph.remove(node);
    };


    return action;
};
