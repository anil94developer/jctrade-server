/** DataTables server-side query parser */
export function parseDataTablesQuery(query) {
  const draw = parseInt(query.draw, 10) || 1;
  const start = parseInt(query.start, 10) || 0;
  const length = Math.min(parseInt(query.length, 10) || 10, 100);
  const search = (query['search[value]'] || query.search || '').trim();
  const orderCol = parseInt(query['order[0][column]'], 10) || 0;
  const orderDir = query['order[0][dir]'] === 'asc' ? 1 : -1;
  return { draw, start, length, search, orderCol, orderDir, page: Math.floor(start / length) + 1 };
}

export function dataTablesResponse(draw, recordsTotal, recordsFiltered, data) {
  return {
    draw,
    recordsTotal,
    recordsFiltered,
    data,
  };
}

/** Simple page/limit pagination */
export function parsePageQuery(query) {
  const page = Math.max(parseInt(query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(query.limit, 10) || 10, 1), 50);
  const skip = (page - 1) * limit;
  return { page, limit, skip };
}

export function pageResponse(data, total, page, limit) {
  const totalPages = Math.ceil(total / limit) || 1;
  return {
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    },
  };
}
