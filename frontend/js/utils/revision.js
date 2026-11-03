export function revisionOptions(item) {
  const source = item?.raw_task || item;
  const revision = source?.updated_at || source?.created_at;
  return revision ? { headers: { 'If-Match': revision } } : {};
}
