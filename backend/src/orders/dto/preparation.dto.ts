import { IsIn, IsOptional, Matches } from 'class-validator';

export const PREPARATION_TARGETS = ['PREPARING', 'READY', 'COMPLETED'] as const;
export type PreparationTarget = (typeof PREPARATION_TARGETS)[number];

export class AdvancePreparationDto {
  @IsIn(PREPARATION_TARGETS)
  status!: PreparationTarget;
}

export class ListAdminOrdersDto {
  @IsOptional()
  @Matches(/^(PAID|PREPARING|READY)(,(PAID|PREPARING|READY))*$/)
  status?: string;

  @IsOptional()
  @IsIn(['PENDING'])
  cancelRequestStatus?: 'PENDING';
}
