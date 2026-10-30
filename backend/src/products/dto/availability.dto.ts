import { Transform, Type, type TransformFnParams } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayNotEmpty,
  ArrayUnique,
  IsArray,
  IsIn,
  ValidateNested,
} from 'class-validator';
import { OrderItemDto } from '../../orders/dto/create-order.dto';
import {
  SIZE_IDS,
  TOPPING_IDS,
  type ProductSize,
  type ToppingId,
} from '../../orders/pricing';

export class SelectionAvailabilityQuery {
  @IsIn(SIZE_IDS)
  size: ProductSize = 'S';

  @Transform(({ value }: TransformFnParams): unknown =>
    typeof value === 'string' ? (value === '' ? [] : value.split(',')) : value,
  )
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(TOPPING_IDS.length)
  @IsIn(TOPPING_IDS, { each: true })
  toppingIds: ToppingId[] = [];
}

export class AvailabilityLineDto extends OrderItemDto {
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(TOPPING_IDS.length)
  @IsIn(TOPPING_IDS, { each: true })
  declare toppingIds: ToppingId[];
}

export class CartAvailabilityDto {
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => AvailabilityLineDto)
  items!: AvailabilityLineDto[];
}
