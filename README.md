# RideAlong-backend

## API Stack

API style: RESTful Web Services
Protocol: HTTP/1.1 / JSON (JavaScript Object Notation)
Base URL Path: /api/

## All endpoints should follow standard HTTP semantic response codes to communicate operational status:

- 200 OK — Request succeeded

- 201 Created — Request succeeded and new resource was created

- 400 Bad Request — Server cannot process request due to user error

- 401 Unauthorized — The user is unauthenticated, that is: missing, malformed, or expired JSON Web Token (JWT).

- 403 Forbidden — The user does not have access rights to the content

- 404 Not Found — The server cannot find the requested resource.

- 500 Internal Server Error — Server-side system crash.

## Endpoints responsible for user authentication.

### Register Account
HTTP Method & Path: POST /api/register

### Login / Session Authentication
HTTP Method & Path: POST /api/login

## Endpoints handling custom organizational folders. 

### Fetch User Categories
HTTP Method & Path: GET /api/categories

### Create Category Folder 
HTTP Method & Path: POST /api/categories

### Delete Category Folder
HTTP Method & Path: DELETE /api/categories/:id


## Endpoints facilitating bookmarking and saves.

### Fetch Flat Resources Array
HTTP Method & Path: GET /api/resources

### Create Resource Entry
HTTP Method & Path: POST /api/resources

### Delete Resource Entry
HTTP Method & Path: DELETE /api/resources/:id
