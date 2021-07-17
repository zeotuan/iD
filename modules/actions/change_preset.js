export const actionChangePreset = (entityID, oldPreset, newPreset, skipFieldDefaults) => {
    const action = (graph) => {
        let entity = graph.entity(entityID);
        let geometry = entity.geometry(graph);
        let tags = entity.tags;

        // preserve tags that the new preset might care about, if any
        if (oldPreset) tags = oldPreset.unsetTags(tags, geometry, newPreset && newPreset.addTags ? Object.keys(newPreset.addTags) : null);
        if (newPreset) tags = newPreset.setTags(tags, geometry, skipFieldDefaults);

        return graph.replace(entity.update({tags: tags}));
    };
    return action;
};
