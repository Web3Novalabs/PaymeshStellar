import crypto from 'crypto';

export interface GroupMember {
  address: string;
  name: string;
  percentage: number; // percentage splits (sum must equal 100)
}

export interface Group {
  id: string; // off-chain unique ID
  groupId: string; // on-chain group ID
  name: string;
  creator: string; // Stellar address of the creator
  paymentToken: string; // Stellar token address
  members: GroupMember[];
  membersCount: number;
  createdAt: Date;
}

export interface GroupsService {
  create(groupData: Omit<Group, 'id' | 'createdAt' | 'membersCount'>): Promise<Group>;
  getById(id: string): Promise<Group | null>;
  getByGroupId(groupId: string): Promise<Group | null>;
  list(options: {
    limit?: number;
    offset?: number;
    creator?: string;
  }): Promise<{ groups: Group[]; totalCount: number }>;
  update(id: string, groupData: Partial<Omit<Group, 'id' | 'createdAt'>>): Promise<Group | null>;
  clear(): Promise<void>; // utility for tests
}

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
    const group = this.groups.find((g) => g.id === id);
    return group || null;
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

    const groups = filtered.slice(offset, offset + limit);

    return {
      groups,
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
