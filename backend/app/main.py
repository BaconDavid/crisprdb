from fastapi import FastAPI
app = FastAPI()


@app.get("/")
async def root():
    return {"message": "Hello World"}



# @app.get("/items/{item_id}")
# async def read_item(item_id):
#     return {"item_id": item_id}

@app.get("/items/{item_id}")
async def read_item(item_id:int):
    return {"item_id": item_id}




@app.get("/users/me")
async def read_user_me():
    return {"user_id": "the current user"}


@app.get("/users/{user_id}")
async def read_user(user_id: str):
    return {"user_id": user_id}


@app.get("/users/{user_id}/items/{item_id}")
async def read_user_item(
    user_id: int, item_id: str, q: str | None = None, short: bool = False
):
    item = {"item_id": item_id, "owner_id": user_id}
    if q:
        item.update({"q": q})
    if not short:
        item.update(
            {"description": "This is an amazing item that has a long description"}
        )
    return item