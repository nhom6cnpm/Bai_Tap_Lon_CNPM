import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { LoginDto } from './login.dto';
import { RegisterDto } from './register.dto';

// Same check the global ValidationPipe does before the controller runs
async function errorsFor(
  dto: typeof LoginDto | typeof RegisterDto,
  body: object,
) {
  const errors = await validate(plainToInstance(dto, body));
  return errors.flatMap((e) => Object.values(e.constraints ?? {}));
}

describe('Auth DTO — mật khẩu phải là chuỗi (tránh HTTP 500 từ bcrypt)', () => {
  const email = 'user@brewlite.vn';

  it.each([123456, { a: 1 }, ['123456'], true, null])(
    'LoginDto từ chối password = %p',
    async (password) => {
      const errors = await errorsFor(LoginDto, { email, password });
      expect(errors).toContain('Mật khẩu phải là chuỗi ký tự');
    },
  );

  it.each([123456, { a: 1 }, ['1234567']])(
    'RegisterDto từ chối password = %p',
    async (password) => {
      const errors = await errorsFor(RegisterDto, { email, password });
      expect(errors).toContain('Mật khẩu phải là chuỗi ký tự');
    },
  );

  it('chấp nhận mật khẩu toàn chữ số nếu gửi dạng chuỗi', async () => {
    expect(await errorsFor(LoginDto, { email, password: '123456' })).toEqual(
      [],
    );
    expect(await errorsFor(RegisterDto, { email, password: '123456' })).toEqual(
      [],
    );
  });

  it('báo lỗi mật khẩu rỗng, quá ngắn, quá 72 ký tự', async () => {
    expect(await errorsFor(LoginDto, { email, password: '' })).toContain(
      'Mật khẩu không được để trống',
    );
    expect(await errorsFor(RegisterDto, { email, password: '123' })).toContain(
      'Mật khẩu phải dài ít nhất 6 ký tự',
    );
    expect(
      await errorsFor(RegisterDto, { email, password: 'a'.repeat(73) }),
    ).toContain('Mật khẩu tối đa 72 ký tự');
  });
});
