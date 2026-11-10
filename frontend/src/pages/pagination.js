export function paginationHandlers(page, totalPages, onChange) {
  return {
    previous: () => onChange(Math.max(1, page - 1)),
    next: () => onChange(Math.min(totalPages, page + 1)),
  }
}
