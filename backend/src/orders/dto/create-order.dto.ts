import {
  ArrayNotEmpty,
  IsArray,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Min,
  ValidateNested,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import {
  SIZE_IDS,
  TOPPING_IDS,
  type ProductSize,
  type ToppingId,
} from '../pricing';

export class OrderItemDto {
  @IsString()
  @IsNotEmpty({ message: 'productId không được để trống' })
  productId!: string;

  @IsIn(SIZE_IDS, { message: 'Size phải thuộc S, M hoặc L' })
  size!: ProductSize;

  @IsArray()
  @IsIn(TOPPING_IDS, { each: true, message: 'Topping không hợp lệ' })
  toppingIds!: ToppingId[];

  @IsInt({ message: 'Số lượng (qty) phải là số nguyên' })
  @Min(1, { message: 'Số lượng (qty) phải lớn hơn hoặc bằng 1' })
  qty!: number;
}

export class CreateOrderDto {
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @IsString()
  @Matches(/^[A-Z0-9][A-Z0-9_-]{0,31}$/, {
    message:
      'Mã giảm giá phải có 1–32 ký tự chữ, số, dấu gạch ngang hoặc gạch dưới.',
  })
  voucherCode?: string;

  @IsArray()
  @ArrayNotEmpty({ message: 'Danh sách items không được để trống' })
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items!: OrderItemDto[];
}
