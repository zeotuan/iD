export const actionChangeMember = (relationId, member, memberIndex) => {
    return (graph) => {
        return graph.replace(graph.entity(relationId).updateMember(member, memberIndex));
    };
};
