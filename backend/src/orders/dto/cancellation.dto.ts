import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString, IsUUID, Length } from 'class-validator';

const trimText = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

export class RequestCancellationDto {
  @Transform(trimText)
  @IsString()
  @Length(1, 500)
  reason!: string;
}

export class ApproveCancellationDto {
  @IsUUID()
  requestId!: string;

  @IsOptional()
  @Transform(trimText)
  @IsString()
  @Length(1, 500)
  note?: string;
}

export class RejectCancellationDto extends RequestCancellationDto {
  @IsUUID()
  requestId!: string;
}

export class ListCancellationRequestsDto {
  @IsIn(['PENDING'])
  cancelRequestStatus = 'PENDING' as const;
}
