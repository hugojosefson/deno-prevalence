import { Action } from "../src/types.ts";
import { MyModel, Post } from "./fixture-types.ts";

export class AddPostAction implements Action<MyModel> {
  constructor(public post: Post) {
  }

  execute(model: MyModel): void {
    model.posts.push(this.post);
  }
}
