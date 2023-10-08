export class Post {
  constructor(
    readonly id: string,
    public subject: string,
  ) {
  }
}

export class User {
  constructor(
    readonly uuid: string,
    public displayName: string,
  ) {
  }
}

export type MyModel = {
  posts: Post[];
  users: User[];
};
