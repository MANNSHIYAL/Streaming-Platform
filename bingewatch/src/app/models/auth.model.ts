export interface RegisterUser {
    username: string,
    email: string,
    password: string,
    role: string
}

export interface LoginUser {
    id?: number,
    user: string,
    password: string
}