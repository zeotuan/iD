import { actionDeleteRelation } from './delete_relation';


export const actionDeleteMember = (relationId, memberIndex) => {
    return (graph) => {
        let relation = graph.entity(relationId)
            .removeMember(memberIndex);

        graph = graph.replace(relation);

        if (relation.isDegenerate()) {
            graph = actionDeleteRelation(relation.id)(graph);
        }

        return graph;
    };
};
