import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  Param,
  Post,
  Query,
  NotFoundException,
  ValidationPipe,
} from '@nestjs/common';
import { ProductsService } from './products.service';
import {
  CartAvailabilityDto,
  SelectionAvailabilityQuery,
} from './dto/availability.dto';

const availabilityValidation = new ValidationPipe({
  transform: true,
  whitelist: true,
  forbidNonWhitelisted: true,
});

@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  async getAllProducts() {
    return this.productsService.findAll();
  }

  @Get(':id/availability')
  @Header('Cache-Control', 'no-store')
  getSelectionAvailability(
    @Param('id') id: string,
    @Query(availabilityValidation) query: SelectionAvailabilityQuery,
  ) {
    return this.productsService.getSelectionAvailability(id, query);
  }

  @Post('availability')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  getCartAvailability(@Body(availabilityValidation) body: CartAvailabilityDto) {
    return this.productsService.getCartAvailability(body.items);
  }

  @Get(':id')
  async getProductById(@Param('id') id: string) {
    const product = await this.productsService.findById(id);
    if (!product) {
      throw new NotFoundException('Product not found');
    }
    return product;
  }
}
