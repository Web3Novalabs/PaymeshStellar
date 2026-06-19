import crypto from 'crypto';
import { type Group, type GroupMember, type GroupsService } from '../types/index.js';

export type { Group, GroupMember, GroupsService };

export class InMemoryGroupsService implements GroupsService {
  private groups: Group[] = [];

  async create(groupData: Omit<Group, 'id' | 'createdAt' | 'membersCount'>): Promise<Group> {
    const group: Group = {
      id: crypto.randomUUID(),
      ...groupData,
      membersCount: groupData.members.length,
      createdAt: new Date(),
    };
    this.groups.push(group);
    return group;
  }

  async getById(id: string): Promise<Group | null> {
    return this.groups.find((g) => g.id === id) ?? null;
  }

  async getByGroupId(groupId: string): Promise<Group | null> {
    const group = this.groups.find((g) => g.groupId === groupId);
    return group || null;
  }

  async list(options: {
    limit?: number;
    offset?: number;
    creator?: string;
  }): Promise<{ groups: Group[]; totalCount: number }> {
    let filtered = [...this.groups];

    if (options.creator) {
      filtered = filtered.filter((g) => g.creator === options.creator);
    }

    const totalCount = filtered.length;
    const limit = options.limit ?? 10;
    const offset = options.offset ?? 0;

    return {
      groups: filtered.slice(offset, offset + limit),
      totalCount,
    };
  }

  async update(
    id: string,
    groupData: Partial<Omit<Group, 'id' | 'createdAt'>>
  ): Promise<Group | null> {
    const index = this.groups.findIndex((g) => g.id === id);
    if (index === -1) return null;

    const existing = this.groups[index];
    const updated: Group = {
      ...existing,
      ...groupData,
      membersCount: groupData.members ? groupData.members.length : existing.membersCount,
    };

    this.groups[index] = updated;
    return updated;
  }

  async clear(): Promise<void> {
    this.groups = [];
  }
}

export const groupsService: GroupsService = new InMemoryGroupsService();
