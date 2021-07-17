import { actionDeleteMember } from './delete_member';


export const actionDeleteMembers = (relationId, memberIndexes) => {
    return (graph) => {
        // Remove the members in descending order so removals won't shift what members
        // are at the remaining indexes
        memberIndexes.sort((a, b) => b - a);
        for (let i in memberIndexes) {
            graph = actionDeleteMember(relationId, memberIndexes[i])(graph);
        }
        return graph;
    };
};
