import { Action } from "../src/types.ts";
import { MyModel, User } from "./fixture-types.ts";

export class AddUserAction implements Action<MyModel> {
  constructor(public user: User) {
  }

  execute(model: MyModel): void {
    model.users.push(this.user);
  }
}
