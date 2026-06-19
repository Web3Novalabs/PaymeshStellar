import { type Group } from '../types/index.js';

export function serializeGroup(group: Group) {
  return {
    id: group.id,
    groupId: group.groupId,
    name: group.name,
    creator: group.creator,
    paymentToken: group.paymentToken,
    members: group.members,
    membersCount: group.membersCount,
    createdAt: group.createdAt,
  };
}
