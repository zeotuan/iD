export const actionAddEntity = (way) => {
    return (graph) => {
        return graph.replace(way);
    };
};

