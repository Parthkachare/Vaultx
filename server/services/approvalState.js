function nextApprovalState(paper, managerSlot) {
  if (managerSlot !== 1 && managerSlot !== 2) {
    throw new Error('Manager slot must be 1 or 2.');
  }
  const manager1Approved = managerSlot === 1 || paper.manager1Approved;
  const manager2Approved = managerSlot === 2 || paper.manager2Approved;
  return {
    manager1Approved,
    manager2Approved,
    status: manager1Approved && manager2Approved ? 'APPROVED' : 'AWAITING_APPROVAL',
  };
}

module.exports = { nextApprovalState };
