//! Re-exports all validation and authorization helpers from [`auth`].
//!
//! This module provides a backward-compatible namespace so that existing
//! call-sites written against `base::validators` continue to work. All
//! implementations live in [`crate::base::auth`].

pub use super::auth::*;
