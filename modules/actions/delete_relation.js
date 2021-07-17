import { actionDeleteMultiple } from './delete_multiple';
import { utilArrayUniq } from '../util';


// https://github.com/openstreetmap/potlatch2/blob/master/net/systemeD/halcyon/connection/actions/DeleteRelationAction.as
export const actionDeleteRelation = (relationID, allowUntaggedMembers) => {

    function canDeleteEntity(entity, graph) {
        return !graph.parentWays(entity).length &&
            !graph.parentRelations(entity).length &&
            (!entity.hasInterestingTags() && !allowUntaggedMembers);
    }


    let action = (graph) => {
        let relation = graph.entity(relationID);

        graph.parentRelations(relation)
            .forEach(function(parent) {
                parent = parent.removeMembersWithID(relationID);
                graph = graph.replace(parent);

                if (parent.isDegenerate()) {
                    graph = actionDeleteRelation(parent.id)(graph);
                }
            });

        let memberIDs = utilArrayUniq(relation.members.map(function(m) { return m.id; }));
        memberIDs.forEach(function(memberID) {
            graph = graph.replace(relation.removeMembersWithID(memberID));

            let entity = graph.entity(memberID);
            if (canDeleteEntity(entity, graph)) {
                graph = actionDeleteMultiple([memberID])(graph);
            }
        });

        return graph.remove(relation);
    };


    return action;
};
