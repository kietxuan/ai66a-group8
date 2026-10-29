from pydantic import BaseModel, ConfigDict, EmailStr, field_validator


class StrictSchema(BaseModel):
    model_config = ConfigDict(extra="forbid")


class Login(StrictSchema):
    email: EmailStr
    password: str

    @field_validator("email", mode="before")
    @classmethod
    def normalize(cls, value):
        return value.strip().lower() if isinstance(value, str) else value

    @field_validator("email")
    @classmethod
    def email_length(cls, value):
        if len(value) > 254:
            raise ValueError("Email tối đa 254 ký tự")
        return value

    @field_validator("password")
    @classmethod
    def password_length(cls, value):
        if len(value) < 8 or len(value.encode("utf-8")) > 72:
            raise ValueError("Mật khẩu từ 8 ký tự và tối đa 72 byte UTF-8")
        return value


class Register(Login):
    name: str

    @field_validator("name")
    @classmethod
    def name_length(cls, value):
        value = value.strip()
        if not 1 <= len(value) <= 100:
            raise ValueError("Tên từ 1 đến 100 ký tự")
        return value
