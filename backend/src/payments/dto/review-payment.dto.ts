import { IsOptional, IsString, MaxLength } from 'class-validator';

export class ReviewPaymentDto {
  // e.g. "Chưa nhận được tiền" — shown to the customer when rejected
  @IsOptional()
  @IsString({ message: 'Ghi chú phải là chuỗi ký tự' })
  @MaxLength(255, { message: 'Ghi chú tối đa 255 ký tự' })
  note?: string;
}
