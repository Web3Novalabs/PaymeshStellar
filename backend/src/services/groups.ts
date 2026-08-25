import crypto from 'crypto';
import { type Group, type GroupMember, type GroupsService } from '../types/index.js';
import { query } from '../db/index.js';

export type { Group, GroupMember, GroupsService };

export class PgGroupsService implements GroupsService {
  async create(groupData: Omit<Group, 'id' | 'createdAt' | 'membersCount'>): Promise<Group> {
    const groupId = crypto.randomUUID();

    // First ensure the creator exists in the users table to satisfy foreign key
    const userRes = await query(
      `INSERT INTO users (wallet_address, name) 
       VALUES ($1, $1) 
       ON CONFLICT (wallet_address) DO UPDATE SET wallet_address = EXCLUDED.wallet_address 
       RETURNING id`,
      [groupData.creator]
    );
    const creatorId = userRes.rows[0].id;

    // Insert group
    const groupRes = await query(
      `INSERT INTO groups (id, creator_id, name, token, onchain_group_id) 
       VALUES ($1, $2, $3, $4, $5) 
       RETURNING created_at`,
      [groupId, creatorId, groupData.name, groupData.paymentToken, groupData.groupId]
    );

    const createdAt = groupRes.rows[0].created_at;

    // Insert members
    for (const member of groupData.members) {
      await query(
        `INSERT INTO members (group_id, member_address, percentage) 
         VALUES ($1, $2, $3)`,
        [groupId, member.address, member.percentage]
      );
    }

    return {
      id: groupId,
      ...groupData,
      membersCount: groupData.members.length,
      createdAt,
    };
  }

  async getById(id: string): Promise<Group | null> {
    const groupRes = await query(
      `SELECT g.id, g.name, g.token, g.onchain_group_id, g.created_at, u.wallet_address as creator
       FROM groups g
       JOIN users u ON g.creator_id = u.id
       WHERE g.id = $1`,
      [id]
    );

    if (groupRes.rowCount === 0) return null;
    const g = groupRes.rows[0];

    const membersRes = await query(
      `SELECT member_address as address, percentage 
       FROM members WHERE group_id = $1`,
      [id]
    );

    const members: GroupMember[] = (
      membersRes.rows as { address: string; percentage: string }[]
    ).map((m) => ({
      address: m.address,
      name: m.address, // name not stored in members table currently
      percentage: parseFloat(m.percentage),
    }));

    return {
      id: g.id,
      groupId: g.onchain_group_id,
      name: g.name,
      creator: g.creator,
      paymentToken: g.token,
      members,
      membersCount: members.length,
      createdAt: g.created_at,
    };
  }

  async getByGroupId(groupId: string): Promise<Group | null> {
    const groupRes = await query(
      `SELECT g.id, g.name, g.token, g.onchain_group_id, g.created_at, u.wallet_address as creator
       FROM groups g
       JOIN users u ON g.creator_id = u.id
       WHERE g.onchain_group_id = $1`,
      [groupId]
    );

    if (groupRes.rowCount === 0) return null;
    const g = groupRes.rows[0];

    const membersRes = await query(
      `SELECT member_address as address, percentage 
       FROM members WHERE group_id = $1`,
      [g.id]
    );

    const members: GroupMember[] = (
      membersRes.rows as { address: string; percentage: string }[]
    ).map((m) => ({
      address: m.address,
      name: m.address,
      percentage: parseFloat(m.percentage),
    }));

    return {
      id: g.id,
      groupId: g.onchain_group_id,
      name: g.name,
      creator: g.creator,
      paymentToken: g.token,
      members,
      membersCount: members.length,
      createdAt: g.created_at,
    };
  }

  async list(options: {
    limit?: number;
    offset?: number;
    creator?: string;
  }): Promise<{ groups: Group[]; totalCount: number }> {
    let whereClause = '';
    const params: (string | number)[] = [];

    if (options.creator) {
      whereClause = 'WHERE u.wallet_address = $1';
      params.push(options.creator);
    }

    const countRes = await query(
      `SELECT COUNT(*) as count 
       FROM groups g 
       JOIN users u ON g.creator_id = u.id 
       ${whereClause}`,
      params
    );
    const totalCount = parseInt(countRes.rows[0].count, 10);

    const limit = options.limit ?? 10;
    const offset = options.offset ?? 0;

    const limitOffsetParams = [...params, limit, offset];

    const groupsRes = await query(
      `SELECT g.id, g.name, g.token, g.onchain_group_id, g.created_at, u.wallet_address as creator
       FROM groups g
       JOIN users u ON g.creator_id = u.id
       ${whereClause}
       ORDER BY g.created_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      limitOffsetParams
    );

    const groups: Group[] = [];
    for (const g of groupsRes.rows) {
      const membersRes = await query(
        `SELECT member_address as address, percentage 
         FROM members WHERE group_id = $1`,
        [g.id]
      );

      const members: GroupMember[] = (
        membersRes.rows as { address: string; percentage: string }[]
      ).map((m) => ({
        address: m.address,
        name: m.address,
        percentage: parseFloat(m.percentage),
      }));

      groups.push({
        id: g.id,
        groupId: g.onchain_group_id,
        name: g.name,
        creator: g.creator,
        paymentToken: g.token,
        members,
        membersCount: members.length,
        createdAt: g.created_at,
      });
    }

    return { groups, totalCount };
  }

  async update(
    id: string,
    groupData: Partial<Omit<Group, 'id' | 'createdAt'>>
  ): Promise<Group | null> {
    const existing = await this.getById(id);
    if (!existing) return null;

    if (groupData.name !== undefined || groupData.paymentToken !== undefined) {
      await query(
        `UPDATE groups SET 
           name = COALESCE($1, name), 
           token = COALESCE($2, token),
           updated_at = NOW()
         WHERE id = $3`,
        [groupData.name, groupData.paymentToken, id]
      );
    }

    if (groupData.members !== undefined) {
      await query('DELETE FROM members WHERE group_id = $1', [id]);
      for (const member of groupData.members) {
        await query(
          `INSERT INTO members (group_id, member_address, percentage) 
           VALUES ($1, $2, $3)`,
          [id, member.address, member.percentage]
        );
      }
    }

    return this.getById(id);
  }

  async clear(): Promise<void> {
    await query('DELETE FROM groups');
  }
}

export const groupsService: GroupsService = new PgGroupsService();
