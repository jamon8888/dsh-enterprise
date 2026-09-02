//! Teloids — deontic norms compiled to Causaloid evaluation.
//! P0: parse YAML, validate structure, return stub evaluation (warn only).
//! Phase 2: integrate `deep_causality_core::Causaloid` for real `error` severity.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct Teloid {
    pub id: String,
    pub name: String,
    pub description: String,
    pub obligation: ObligationType,
    pub scope: Vec<String>,        // e.g. ["tool:bash", "tool:deploy"]
    pub condition: Option<String>, // optional predicate expression
    pub severity: Severity,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum ObligationType {
    #[default]
    Must, // hard requirement
    Should, // soft recommendation
    May,    // permission
    Forbid, // prohibition
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum Severity {
    #[default]
    Warn,
    Error,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct TeloidsConfig {
    pub teloids: Vec<Teloid>,
    pub default_severity: Severity,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct ActionContext {
    pub tool: String,
    pub args: HashMap<String, serde_json::Value>,
    pub principal: Option<String>,
    pub resource: Option<String>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct EthosResult {
    pub disposition: EthosDisposition,
    pub violated: Vec<String>, // teloid IDs
    pub reason: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum EthosDisposition {
    #[default]
    Allow,
    Deny,
    Oblige, // must perform compensating action
}

/// P0 stub: parse YAML, check scope match, return warn-only.
/// Phase 2: compile to `deep_causality_core::Causaloid` and evaluate.
pub fn evaluate_teloids(
    teloids_yaml: &str,
    action: &ActionContext,
    config: &TeloidsConfig,
) -> Result<EthosResult, String> {
    let teloids: Vec<Teloid> = serde_yaml::from_str(teloids_yaml)
        .map_err(|e| format!("Teloids YAML parse error: {}", e))?;

    let mut violated = Vec::new();
    let mut disposition = EthosDisposition::Allow;
    let mut reasons = Vec::new();

    for t in &teloids {
        // Scope match: does this teloid apply to the action?
        let applies = t.scope.iter().any(|s| {
            s == &action.tool || action.resource.as_ref().map(|r| s == r).unwrap_or(false)
        });
        if !applies {
            continue;
        }

        // Condition evaluation (P0: skip, always applies if scope matches)
        // Phase 2: evaluate `t.condition` as predicate

        match t.obligation {
            ObligationType::Forbid => {
                violated.push(t.id.clone());
                reasons.push(format!("Forbidden by teloid '{}': {}", t.name, t.description));
                disposition = EthosDisposition::Deny;
            }
            ObligationType::Must => {
                // Check if action satisfies obligation (P0: assume not satisfied)
                violated.push(t.id.clone());
                reasons.push(format!("Required by teloid '{}': {}", t.name, t.description));
                disposition = EthosDisposition::Oblige;
            }
            ObligationType::Should => {
                reasons.push(format!("Recommended by teloid '{}': {}", t.name, t.description));
                if disposition == EthosDisposition::Allow {
                    disposition = EthosDisposition::Allow; // soft
                }
            }
            ObligationType::May => {
                // Permission granted, no violation
            }
        }
    }

    // P0: always warn, never error (Phase 2: respect severity)
    let final_disposition = if matches!(disposition, EthosDisposition::Deny) {
        EthosDisposition::Deny
    } else {
        EthosDisposition::Allow
    };

    Ok(EthosResult { disposition: final_disposition, violated, reason: reasons.join("; ") })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn teloid_forbid_bash_rmrf() {
        let yaml = r#"
- id: "no-destructive"
  name: "No destructive commands"
  description: "rm -rf forbidden"
  obligation: "forbid"
  scope: ["tool:bash"]
  severity: "error"
"#;
        let config = TeloidsConfig { teloids: vec![], default_severity: Severity::Warn };
        let action = ActionContext {
            tool: "tool:bash".into(),
            args: [("command".into(), serde_json::Value::String("rm -rf /".into()))].into(),
            principal: None,
            resource: None,
        };
        let res = evaluate_teloids(yaml, &action, &config).unwrap();
        assert_eq!(res.disposition, EthosDisposition::Deny);
        assert!(res.violated.contains(&"no-destructive".into()));
    }
}
