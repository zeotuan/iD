export const actionChangeTags = (entityId, tags) => {
    return (graph) => {
        let entity = graph.entity(entityId);
        return graph.replace(entity.update({tags: tags}));
    };
};
