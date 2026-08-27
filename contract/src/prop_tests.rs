/// Property-based tests for the distribution math layer.
///
/// These tests use proptest's low-level `TestRunner` API instead of the
/// `proptest!` macro, which avoids macro-expansion issues in `#![no_std]` crates.
///
/// Each test runs exactly 256 cases (controlled by `PROPTEST_CASES` env var in CI).
/// Failing seeds are written to `proptest-regressions/` for reproducibility.
#[cfg(test)]
mod distribution_props {
    extern crate std;
    use std::vec::Vec as StdVec;

    use crate::base;
    use crate::base::errors::AutoShareError;
    use crate::base::types::GroupMember;
    use proptest::prelude::*;
    use proptest::test_runner::{Config, TestRunner};
    use soroban_sdk::testutils::Address as _;
    use soroban_sdk::{Address, Env, String};

    // ── constant ──────────────────────────────────────────────────────────

    const CASES: u32 = 256;

    // ── helpers ────────────────────────────────────────────────────────────

    fn make_members(env: &Env, bps: &StdVec<u32>) -> soroban_sdk::Vec<GroupMember> {
        let mut members = soroban_sdk::Vec::new(env);
        let joined_at = env.ledger().timestamp();
        for (i, &pct) in bps.iter().enumerate() {
            members.push_back(GroupMember {
                address: Address::generate(env),
                name: String::from_str(env, if i == 0 { "m0" } else { "mx" }),
                percentage: pct,
                joined_at,
            });
        }
        members
    }

    // ── strategies ─────────────────────────────────────────────────────────

    /// Produce a non-empty `Vec<u32>` of length 1..=50 where every element ≥ 1
    /// and the sum is exactly 10_000 (basis points for 100 %).
    fn bps_partition() -> BoxedStrategy<StdVec<u32>> {
        (1usize..=50usize)
            .prop_flat_map(|count| {
                if count == 1 {
                    return Just(std::vec![10_000u32]).boxed();
                }
                proptest::collection::vec(1u32..=9_999u32, count - 1)
                    .prop_map(|mut cuts| {
                        cuts.sort_unstable();
                        cuts.dedup();
                        let mut parts: StdVec<u32> = StdVec::with_capacity(cuts.len() + 1);
                        let mut prev = 0u32;
                        for &c in &cuts {
                            let diff = c - prev;
                            if diff > 0 {
                                parts.push(diff);
                            }
                            prev = c;
                        }
                        let tail = 10_000u32 - prev;
                        if tail > 0 {
                            parts.push(tail);
                        }
                        parts
                    })
                    .boxed()
            })
            .boxed()
    }

    /// Positive `i128` across the full non-overflowing range for `calculate_share`.
    fn safe_amount() -> BoxedStrategy<i128> {
        (1i128..=base::utils::MAX_SAFE_TOTAL).boxed()
    }

    fn runner() -> TestRunner {
        TestRunner::new(Config {
            cases: CASES,
            ..Default::default()
        })
    }

    // ── property 1: shares sum exactly to total ────────────────────────────

    /// For every valid (bps, total) pair, `sum(distribute(total)) == total`.
    #[test]
    fn prop_shares_sum_to_total() {
        let strategy = (bps_partition(), safe_amount());
        runner()
            .run(&strategy, |(bps, total)| {
                let env = Env::default();
                let members = make_members(&env, &bps);
                let shares = base::utils::distribute_amounts(&env, total, &members)
                    .map_err(|e| TestCaseError::fail(std::format!("{:?}", e)))?;
                let share_sum: i128 = shares.iter().sum();
                prop_assert_eq!(share_sum, total);
                Ok(())
            })
            .unwrap();
    }

    // ── property 2: non-final shares equal floor division ─────────────────

    /// Every non-final share == floor(total * bps / 10_000).
    /// Final member's dust deviation is < member_count.
    #[test]
    fn prop_non_final_shares_are_floor() {
        let strategy = (bps_partition(), safe_amount());
        runner()
            .run(&strategy, |(bps, total)| {
                let env = Env::default();
                let members = make_members(&env, &bps);
                let shares = base::utils::distribute_amounts(&env, total, &members)
                    .map_err(|e| TestCaseError::fail(std::format!("{:?}", e)))?;

                let len = bps.len();
                for (i, &pct) in bps.iter().enumerate().take(len.saturating_sub(1)) {
                    let expected = (total * pct as i128) / 10_000;
                    let actual = shares.get(i as u32).unwrap();
                    prop_assert_eq!(
                        actual,
                        expected,
                        "member {} share: floor {} got {}",
                        i,
                        expected,
                        actual
                    );
                }
                let last_floor = (total * bps[len - 1] as i128) / 10_000;
                let last_actual = shares.get((len - 1) as u32).unwrap();
                let dust = (last_actual - last_floor).abs();
                prop_assert!(
                    dust < len as i128,
                    "final member dust {} >= member_count {}",
                    dust,
                    len
                );
                Ok(())
            })
            .unwrap();
    }

    // ── property 3: no share is negative ──────────────────────────────────

    /// No share is ever negative for a positive total.
    #[test]
    fn prop_no_negative_shares() {
        let strategy = (bps_partition(), safe_amount());
        runner()
            .run(&strategy, |(bps, total)| {
                let env = Env::default();
                let members = make_members(&env, &bps);
                let shares = base::utils::distribute_amounts(&env, total, &members)
                    .map_err(|e| TestCaseError::fail(std::format!("{:?}", e)))?;
                for share in shares.iter() {
                    prop_assert!(share >= 0, "negative share: {}", share);
                }
                Ok(())
            })
            .unwrap();
    }

    // ── property 4: total == 0 yields all-zero shares ─────────────────────

    /// When total is 0 every member receives 0.
    #[test]
    fn prop_zero_total_all_zeros() {
        runner()
            .run(&bps_partition(), |bps| {
                let env = Env::default();
                let members = make_members(&env, &bps);
                let shares = base::utils::distribute_amounts(&env, 0, &members)
                    .map_err(|e| TestCaseError::fail(std::format!("{:?}", e)))?;
                for share in shares.iter() {
                    prop_assert_eq!(share, 0i128);
                }
                Ok(())
            })
            .unwrap();
    }

    // ── property 5: conservation across two calls ─────────────────────────

    /// `sum(distribute(a)) + sum(distribute(b)) == sum(distribute(a+b))`.
    #[test]
    fn prop_split_additive() {
        let half_max = base::utils::MAX_SAFE_TOTAL / 2;
        let strategy = (bps_partition(), 0i128..=half_max, 0i128..=half_max);
        runner()
            .run(&strategy, |(bps, a, b)| {
                let env = Env::default();
                let members = make_members(&env, &bps);

                let sum_a: i128 = base::utils::distribute_amounts(&env, a, &members)
                    .map_err(|e| TestCaseError::fail(std::format!("{:?}", e)))?
                    .iter()
                    .sum();
                let sum_b: i128 = base::utils::distribute_amounts(&env, b, &members)
                    .map_err(|e| TestCaseError::fail(std::format!("{:?}", e)))?
                    .iter()
                    .sum();
                let sum_ab: i128 = base::utils::distribute_amounts(&env, a + b, &members)
                    .map_err(|e| TestCaseError::fail(std::format!("{:?}", e)))?
                    .iter()
                    .sum();

                prop_assert_eq!(sum_a, a);
                prop_assert_eq!(sum_b, b);
                prop_assert_eq!(sum_ab, a + b);
                prop_assert_eq!(sum_a + sum_b, sum_ab);
                Ok(())
            })
            .unwrap();
    }

    // ── property 6: overflow boundary ─────────────────────────────────────

    /// Any total above MAX_SAFE_TOTAL with percentage=10_000 returns
    /// `InvalidAmount`; it never traps.
    #[test]
    fn prop_overflow_returns_invalid_amount() {
        runner()
            .run(&(1i128..=10_000i128), |delta| {
                let total = base::utils::MAX_SAFE_TOTAL + delta;
                let result = base::utils::calculate_share(total, 10_000);
                prop_assert_eq!(
                    result,
                    Err(AutoShareError::InvalidAmount),
                    "expected InvalidAmount for MAX_SAFE + {}, got {:?}",
                    delta,
                    result
                );
                Ok(())
            })
            .unwrap();
    }
}
