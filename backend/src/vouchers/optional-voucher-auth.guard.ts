import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/** Guest pricing stays public; any supplied token must be valid. */
@Injectable()
export class OptionalVoucherAuthGuard extends AuthGuard('jwt') {
  canActivate(context: ExecutionContext) {
    const request = context
      .switchToHttp()
      .getRequest<{ headers: { authorization?: string } }>();
    return request.headers.authorization === undefined
      ? true
      : super.canActivate(context);
  }
}
