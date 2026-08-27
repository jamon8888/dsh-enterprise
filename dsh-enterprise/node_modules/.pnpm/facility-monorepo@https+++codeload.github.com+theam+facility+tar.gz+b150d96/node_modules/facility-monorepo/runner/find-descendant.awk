# Find exactly one process with the expected UID and command beneath root_pid.
# Print it only when the process tree is unambiguous; otherwise fail closed.
{
  parent[$1] = $2
  owner[$1] = $3
  process_command[$1] = $4
}

END {
  match_count = 0
  matched_pid = ""
  for (pid in parent) {
    if (owner[pid] != target_uid || process_command[pid] != target_command) continue

    cursor = pid
    depth = 0
    while (cursor != root_pid && cursor > 1 && parent[cursor] != "" && depth < 4096) {
      cursor = parent[cursor]
      depth++
    }
    if (cursor == root_pid) {
      matched_pid = pid
      match_count++
    }
  }

  if (match_count != 1) exit 1
  print matched_pid
}
