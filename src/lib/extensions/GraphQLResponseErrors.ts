export class GraphQLResponseErrors extends Error {
    public readonly errors: any[];

    constructor(errors: any[]) {
        super('Something went wrong with a GraphQL query.');
        this.errors = errors;
    }
}
