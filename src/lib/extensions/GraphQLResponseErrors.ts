export interface GraphQLErrorStructure {
    /** The message of the error */
    message: string;
    /** The location information of the error */
    locations: {
        line: number;
        column: number;
        // I think there are some other things that appear, but I'm not sure.
        [key: string]: any;
    }[];
};

export class GraphQLResponseErrors extends Error {
    public readonly errors: GraphQLErrorStructure[];

    /**
     * Error information from a GraphQL endpoint.
     * @param errors The object of GraphQL errors provided.
     */
    constructor(errors: GraphQLErrorStructure[]) {
        super('Something went wrong with a GraphQL query.');
        this.errors = errors;
    }
}
