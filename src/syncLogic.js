import { addWeeks, formatPhone, norm, normalizeDate, val, isUnknown } from "./importExcel.js";

export function documentId(value) {
  return encodeURIComponent(String(value)).replaceAll("%", "_");
}

export function normalizeGroupCode(code) {
  return val(code);
}

function getTimestamp(timestampProvider) {
  if (typeof timestampProvider === "function") {
    return timestampProvider();
  }
  return new Date();
}

export function hasExcelMetadataChanged(existing, incoming) {
  if (!existing) return true;
  const fields = [
    "batchCode",
    "expectedStudents",
    "startDate",
    "trackName",
    "coordinatorName",
    "coordinatorEmail",
    "day",
    "time",
    "zoomLink",
    "whatsappLink",
    "tableLink",
    "coachName",
    "coachPhone",
  ];
  return fields.some((f) => {
    const exVal = val(existing[f]);
    const incVal = val(incoming[f]);
    if (isUnknown(exVal) && isUnknown(incVal)) return false;
    return exVal !== incVal;
  });
}

export function hasStudentChanged(existing, incoming, newCoordinatorEmail) {
  if (!existing) return true;
  if (
    newCoordinatorEmail &&
    (existing.coordinatorEmail || "").toLowerCase() !== newCoordinatorEmail.toLowerCase()
  ) {
    return true;
  }
  const fields = [
    "name",
    "mobile",
    "email",
    "gender",
    "studentType",
    "moduleName",
    "batch",
  ];
  return fields.some((f) => {
    const incVal = incoming[f];
    if (incVal !== undefined && incVal !== "" && incVal !== "Unknown") {
      return (existing[f] ?? "") !== incVal;
    }
    return false;
  });
}

export function resolveCoordinatorIdentity(rawCoordinator, existingUsers = []) {
  const coordName = val(rawCoordinator?.coordinatorName);
  const coordEmail = val(rawCoordinator?.coordinatorEmail).toLowerCase();

  const isNameEmpty = !coordName || isUnknown(coordName);
  const isEmailEmpty = !coordEmail || isUnknown(coordEmail);

  if (isNameEmpty && isEmailEmpty) {
    return {
      status: "unassigned",
      email: "",
      name: "",
      uid: null,
    };
  }

  const usersList = Array.isArray(existingUsers) ? existingUsers : [];
  const usersByEmail = new Map();
  const usersByName = new Map();

  for (const u of usersList) {
    const email = (u.email || "").trim().toLowerCase();
    const uid = u.id || u.uid || null;
    const name = val(u.name || u.displayName);
    if (email) {
      usersByEmail.set(email, { uid, email, name: name || email, role: u.role });
    }
    if (name) {
      usersByName.set(norm(name), { uid, email, name, role: u.role });
    }
  }

  let resolvedUser = null;
  let targetEmail = "";

  if (!isEmailEmpty) {
    targetEmail = coordEmail;
    resolvedUser = usersByEmail.get(targetEmail);
  } else if (coordName.includes("@")) {
    targetEmail = coordName.toLowerCase();
    resolvedUser = usersByEmail.get(targetEmail);
  } else if (!isNameEmpty) {
    resolvedUser = usersByName.get(norm(coordName));
    if (resolvedUser) {
      targetEmail = resolvedUser.email;
    }
  }

  if (usersList.length > 0) {
    if (resolvedUser) {
      return {
        status: "resolved",
        email: resolvedUser.email,
        name: resolvedUser.name || coordName || resolvedUser.email,
        uid: resolvedUser.uid,
      };
    }

    return {
      status: "unknown",
      email: targetEmail,
      name: coordName,
      uid: null,
      reason: `Unknown coordinator "${coordName || targetEmail}". Coordinator must be a registered user.`,
    };
  }

  // Fallback when no user list is provided (e.g. lightweight unit tests)
  if (targetEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(targetEmail)) {
    return {
      status: "resolved",
      email: targetEmail,
      name: coordName || targetEmail,
      uid: null,
    };
  }

  return {
    status: "unknown",
    email: targetEmail,
    name: coordName,
    uid: null,
    reason: `Unknown coordinator "${coordName || targetEmail}". Valid coordinator email or registered user required.`,
  };
}

export function generateGroupSessionOps(group, coordinatorEmail, coordinatorName) {
  const startDate = normalizeDate(group.startDate);

  return Array.from({ length: 10 }, (_, index) => {
    const sessionId = `${group.groupCode}:session:${index + 1}`;
    return {
      collectionName: "sessions",
      id: documentId(sessionId),
      sessionId,
      sessionNumber: index + 1,
      groupCode: group.groupCode,
      data: {
        groupCode: group.groupCode,
        sessionNumber: index + 1,
        scheduledDate: addWeeks(startDate, index),
        time: group.time || "",
        coordinatorEmail: coordinatorEmail || "",
        coordinatorName: coordinatorName || "",
        coachName: group.coachName || "",
        trackName: group.trackName || "",
        zoomLink: group.zoomLink || "",
      },
    };
  });
}

export function reconcileWorkbook({
  importedGroups = [],
  importedStudents = [],
  existingGroups = [],
  existingStudents = [],
  existingSessions = [],
  existingUsers = [],
  existingNotifications = [],
  existingCredentials = [],
  timestampProvider = () => new Date(),
}) {
  const operations = [];
  const invalidRows = [];
  const skippedGroups = [];

  let createdGroups = 0;
  let updatedGroups = 0;
  let unchangedGroups = 0;
  let createdStudents = 0;
  let updatedStudents = 0;
  let unchangedStudents = 0;
  let newSessions = 0;
  let reassignedSessions = 0;
  let notificationsCreated = 0;
  let notificationsSuperseded = 0;

  // Build maps of existing Firestore state
  const existingGroupMap = new Map();
  for (const g of existingGroups) {
    existingGroupMap.set(norm(g.groupCode), g);
  }

  const existingStudentsMap = new Map();
  for (const s of existingStudents) {
    const key = `${norm(s.groupCode)}:${s.userId || formatPhone(s.mobile) || norm(s.name)}`;
    existingStudentsMap.set(key, s);
  }

  const existingSessionIds = new Set(existingSessions.map((s) => s.id));
  const existingCredentialsMap = new Map();
  for (const c of existingCredentials) {
    existingCredentialsMap.set(norm(c.groupCode), c);
  }

  // Deduplicate incoming groups by normalized groupCode
  const uniqueIncomingGroups = new Map();
  for (const group of importedGroups) {
    const key = norm(group.groupCode);
    if (!uniqueIncomingGroups.has(key)) {
      uniqueIncomingGroups.set(key, group);
    } else {
      const existing = uniqueIncomingGroups.get(key);
      uniqueIncomingGroups.set(key, { ...existing, ...group });
    }
  }

  // Track reassigned groups
  const reassignedGroupsMap = new Map();

  // 1. Process Groups
  for (const group of uniqueIncomingGroups.values()) {
    const groupKey = norm(group.groupCode);
    const existingGroup = existingGroupMap.get(groupKey);
    const groupId = existingGroup?.id || documentId(group.groupCode);

    const coordResolution = resolveCoordinatorIdentity(
      { coordinatorName: group.coordinatorName, coordinatorEmail: group.coordinatorEmail },
      existingUsers,
    );

    if (coordResolution.status === "unassigned") {
      skippedGroups.push({
        sheetName: group.sheetName || "Workbook",
        groupCode: group.groupCode,
        excelRow: group.excelRow || 0,
        reason: "No Group Coordinator assigned (cell is empty or unassigned)",
      });
      continue;
    }

    if (coordResolution.status === "unknown") {
      invalidRows.push({
        sheetName: group.sheetName || "Workbook",
        groupCode: group.groupCode,
        excelRow: group.excelRow || 0,
        reason: coordResolution.reason,
      });
      continue;
    }

    const newCoordEmail = coordResolution.email;
    const newCoordName = coordResolution.name;
    const newCoordUid = coordResolution.uid;

    const { zoomUserId, zoomPassword, sheetName, excelRow, ...publicGroup } = group;

    if (!existingGroup) {
      // CASE 1: No group exists -> create group & notify
      const timestamp = getTimestamp(timestampProvider);
      operations.push({
        type: "CREATE_GROUP",
        collectionName: "groups",
        id: groupId,
        groupCode: group.groupCode,
        assignmentCount: 1,
        coordinatorEmail: newCoordEmail,
        data: {
          ...publicGroup,
          groupCode: group.groupCode,
          coordinatorEmail: newCoordEmail,
          coordinatorName: newCoordName,
          coordinatorUid: newCoordUid,
          assignmentCount: 1,
          lastAssignedCoordinatorEmail: newCoordEmail,
          assignedAt: timestamp,
          createdAt: timestamp,
        },
      });
      createdGroups++;

      // Create 10 weekly sessions
      const sessions = generateGroupSessionOps(group, newCoordEmail, newCoordName);
      for (const sessOp of sessions) {
        operations.push({
          type: "CREATE_SESSION",
          ...sessOp,
        });
        newSessions++;
      }

      // Initial assignment notification (#1)
      const notifId = documentId(`notif:${group.groupCode}:assign:1`);
      operations.push({
        type: "CREATE_NOTIFICATION",
        collectionName: "notifications",
        id: notifId,
        recipientEmail: newCoordEmail,
        groupCode: group.groupCode,
        assignmentIndex: 1,
        notifType: "assignment",
        data: {
          recipientEmail: newCoordEmail,
          recipientUid: newCoordUid,
          groupCode: group.groupCode,
          type: "assignment",
          assignmentIndex: 1,
          title: "New Group Assigned",
          message: `Group ${group.groupCode} (${group.trackName || "Coaching"}) has been assigned to you.`,
          groupId,
          trackName: group.trackName || "",
          coachName: group.coachName || "",
          day: group.day || "",
          time: group.time || "",
          startDate: group.startDate || "",
          read: false,
          active: true,
          superseded: false,
          status: "active",
          createdAt: timestamp,
        },
      });
      notificationsCreated++;

      if (zoomUserId || zoomPassword) {
        operations.push({
          type: "CREATE_CREDENTIALS",
          collectionName: "zoomCredentials",
          id: groupId,
          groupCode: group.groupCode,
          coordinatorEmail: newCoordEmail,
          data: {
            groupCode: group.groupCode,
            coordinatorEmail: newCoordEmail,
            zoomUserId: zoomUserId || "",
            zoomPassword: zoomPassword || "",
          },
        });
      }
    } else {
      // Existing group in Firestore
      const existingEmail = (existingGroup.coordinatorEmail || "").trim().toLowerCase();
      const isUnassignedPrior = !existingEmail;
      const isReassignment = !isUnassignedPrior && existingEmail !== newCoordEmail;
      const isSameCoordinator = !isUnassignedPrior && existingEmail === newCoordEmail;

      if (isUnassignedPrior || isReassignment) {
        const nextAssignmentCount = isUnassignedPrior
          ? 1
          : (existingGroup.assignmentCount || 1) + 1;

        const timestamp = getTimestamp(timestampProvider);
        operations.push({
          type: "UPDATE_GROUP",
          collectionName: "groups",
          id: groupId,
          groupCode: group.groupCode,
          assignmentCount: nextAssignmentCount,
          coordinatorEmail: newCoordEmail,
          data: {
            ...publicGroup,
            coordinatorEmail: newCoordEmail,
            coordinatorName: newCoordName,
            coordinatorUid: newCoordUid,
            assignmentCount: nextAssignmentCount,
            lastAssignedCoordinatorEmail: newCoordEmail,
            assignedAt: timestamp,
            updatedAt: timestamp,
          },
        });
        updatedGroups++;

        reassignedGroupsMap.set(groupKey, {
          newEmail: newCoordEmail,
          newName: newCoordName,
          newUid: newCoordUid,
        });

        // Supersede previous active notifications for this group
        for (const notif of existingNotifications) {
          if (
            norm(notif.groupCode) === groupKey &&
            !notif.superseded &&
            notif.active !== false
          ) {
            operations.push({
              type: "UPDATE_NOTIFICATION",
              collectionName: "notifications",
              id: notif.id,
              groupCode: group.groupCode,
              superseded: true,
              data: {
                superseded: true,
                supersededAt: timestamp,
                supersededByCoordinatorEmail: newCoordEmail,
                supersededByAssignmentIndex: nextAssignmentCount,
                active: false,
                status: "superseded",
              },
            });
            notificationsSuperseded++;
          }
        }

        // Create new assignment notification
        const notifType = isUnassignedPrior ? "assignment" : "reassignment";
        const notifTitle = isUnassignedPrior ? "New Group Assigned" : "Group Reassigned";
        const notifMessage = isUnassignedPrior
          ? `Group ${group.groupCode} (${group.trackName || "Coaching"}) has been assigned to you.`
          : `Group ${group.groupCode} (${group.trackName || "Coaching"}) has been reassigned to you.`;

        const notifId = documentId(`notif:${group.groupCode}:assign:${nextAssignmentCount}`);
        operations.push({
          type: "CREATE_NOTIFICATION",
          collectionName: "notifications",
          id: notifId,
          recipientEmail: newCoordEmail,
          groupCode: group.groupCode,
          assignmentIndex: nextAssignmentCount,
          notifType,
          data: {
            recipientEmail: newCoordEmail,
            recipientUid: newCoordUid,
            groupCode: group.groupCode,
            type: notifType,
            assignmentIndex: nextAssignmentCount,
            title: notifTitle,
            message: notifMessage,
            groupId,
            trackName: group.trackName || "",
            coachName: group.coachName || "",
            day: group.day || "",
            time: group.time || "",
            startDate: group.startDate || "",
            read: false,
            active: true,
            superseded: false,
            status: "active",
            createdAt: timestamp,
          },
        });
        notificationsCreated++;

        // Update Zoom credentials access
        if (existingCredentialsMap.has(groupKey) || zoomUserId || zoomPassword) {
          operations.push({
            type: "UPDATE_CREDENTIALS",
            collectionName: "zoomCredentials",
            id: groupId,
            groupCode: group.groupCode,
            coordinatorEmail: newCoordEmail,
            data: {
              groupCode: group.groupCode,
              coordinatorEmail: newCoordEmail,
              ...(zoomUserId ? { zoomUserId } : {}),
              ...(zoomPassword ? { zoomPassword } : {}),
            },
          });
        }
      } else if (isSameCoordinator) {
        // Idempotent: no new notification
        const isMetadataChanged = hasExcelMetadataChanged(existingGroup, group);
        if (isMetadataChanged) {
          const timestamp = getTimestamp(timestampProvider);
          operations.push({
            type: "UPDATE_GROUP",
            collectionName: "groups",
            id: groupId,
            groupCode: group.groupCode,
            data: {
              ...publicGroup,
              coordinatorEmail: newCoordEmail,
              coordinatorName: newCoordName,
              coordinatorUid: newCoordUid,
              updatedAt: timestamp,
            },
          });
          updatedGroups++;

          if (zoomUserId || zoomPassword) {
            operations.push({
              type: "UPDATE_CREDENTIALS",
              collectionName: "zoomCredentials",
              id: groupId,
              groupCode: group.groupCode,
              coordinatorEmail: newCoordEmail,
              data: {
                groupCode: group.groupCode,
                coordinatorEmail: newCoordEmail,
                zoomUserId: zoomUserId || "",
                zoomPassword: zoomPassword || "",
              },
            });
          }
        } else {
          unchangedGroups++;
        }
      }

      // Create ONLY missing sessions for existing group
      const sessions = generateGroupSessionOps(group, newCoordEmail, newCoordName);
      for (const sessOp of sessions) {
        if (!existingSessionIds.has(sessOp.id)) {
          operations.push({
            type: "CREATE_SESSION",
            ...sessOp,
          });
          newSessions++;
        }
      }
    }
  }

  // 2. Synchronize Sessions for reassigned groups
  for (const session of existingSessions) {
    const reassigned = reassignedGroupsMap.get(norm(session.groupCode));
    if (reassigned) {
      if ((session.coordinatorEmail || "").toLowerCase() !== reassigned.newEmail.toLowerCase()) {
        operations.push({
          type: "REASSIGN_SESSION",
          collectionName: "sessions",
          id: session.id,
          coordinatorEmail: reassigned.newEmail,
          data: {
            coordinatorEmail: reassigned.newEmail,
            coordinatorName: reassigned.newName,
          },
        });
        reassignedSessions++;
      }
    }
  }

  // 3. Process Students from Workbook
  for (const st of importedStudents) {
    const studentKey = `${norm(st.groupCode)}:${st.userId || formatPhone(st.mobile) || norm(st.name)}`;
    const existingStudent = existingStudentsMap.get(studentKey);
    const parentGroup = uniqueIncomingGroups.get(norm(st.groupCode));
    const coordEmail = parentGroup?.coordinatorEmail || st.coordinatorEmail || "";

    if (!existingStudent) {
      const timestamp = getTimestamp(timestampProvider);
      operations.push({
        type: "CREATE_STUDENT",
        collectionName: "students",
        id: documentId(studentKey),
        key: studentKey,
        status: "لم يُرسل",
        data: {
          groupCode: st.groupCode,
          userId: st.userId || "",
          name: st.name || "Unnamed",
          mobile: st.mobile || "",
          email: st.email || "",
          gender: st.gender || "",
          studentType: st.studentType || "",
          moduleName: st.moduleName || "",
          batch: st.batch || "",
          status: "لم يُرسل",
          coordinatorEmail: coordEmail,
          createdAt: timestamp,
        },
      });
      createdStudents++;
    } else if (hasStudentChanged(existingStudent, st, coordEmail)) {
      const timestamp = getTimestamp(timestampProvider);
      operations.push({
        type: "UPDATE_STUDENT",
        collectionName: "students",
        id: existingStudent.id,
        key: studentKey,
        preservedStatus: existingStudent.status,
        data: {
          name: st.name || existingStudent.name,
          mobile: st.mobile || existingStudent.mobile,
          email: st.email || existingStudent.email,
          gender: st.gender || existingStudent.gender,
          studentType: st.studentType || existingStudent.studentType,
          moduleName: st.moduleName || existingStudent.moduleName,
          batch: st.batch || existingStudent.batch,
          coordinatorEmail: coordEmail,
          updatedAt: timestamp,
        },
      });
      updatedStudents++;
    } else {
      unchangedStudents++;
    }
  }

  // 4. Update coordinatorEmail for existing students whose group was reassigned
  for (const student of existingStudents) {
    const reassigned = reassignedGroupsMap.get(norm(student.groupCode));
    if (reassigned) {
      if ((student.coordinatorEmail || "").toLowerCase() !== reassigned.newEmail.toLowerCase()) {
        const alreadyQueued = operations.some(
          (op) => op.collectionName === "students" && op.id === student.id,
        );
        if (!alreadyQueued) {
          operations.push({
            type: "UPDATE_STUDENT",
            collectionName: "students",
            id: student.id,
            key: `${norm(student.groupCode)}:${student.userId || formatPhone(student.mobile) || norm(student.name)}`,
            preservedStatus: student.status,
            data: {
              coordinatorEmail: reassigned.newEmail,
            },
          });
          updatedStudents++;
        }
      }
    }
  }

  return {
    operations,
    createdGroups,
    updatedGroups,
    unchangedGroups,
    createdStudents,
    updatedStudents,
    unchangedStudents,
    newSessions,
    reassignedSessions,
    notificationsCreated,
    notificationsSuperseded,
    skippedGroups,
    invalidRows,
  };
}

export function generateMissingSessions(groups, existingSessions, timestampProvider = () => new Date()) {
  const existingSessionIds = new Set(existingSessions.map((s) => s.id));
  const operations = [];

  for (const group of groups) {
    const sessions = generateGroupSessionOps(
      group,
      group.coordinatorEmail || "",
      group.coordinatorName || "",
    );
    for (const sessOp of sessions) {
      if (!existingSessionIds.has(sessOp.id)) {
        operations.push({
          type: "CREATE_SESSION",
          ...sessOp,
        });
      }
    }
  }

  return operations;
}
