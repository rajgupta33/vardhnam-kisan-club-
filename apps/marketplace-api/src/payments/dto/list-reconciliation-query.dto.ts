import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

/**
 * No filters yet, on purpose. Every row this endpoint returns is something
 * finance has to look at, so there is nothing to narrow down to.
 */
export class ListReconciliationQueryDto extends PaginationQueryDto {}
