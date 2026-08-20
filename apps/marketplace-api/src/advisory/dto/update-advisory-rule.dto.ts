import { PartialType } from '@nestjs/swagger';
import { CreateAdvisoryRuleDto } from './create-advisory-rule.dto';

export class UpdateAdvisoryRuleDto extends PartialType(CreateAdvisoryRuleDto) {}
