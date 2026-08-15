export function roleLevel(role) {
  return role === 'owner' ? 4 : role === 'admin' ? 3 : role === 'moderator' ? 2 : 1;
}

export function isModOrAdmin(role) {
  return roleLevel(role) >= 2;
}
