
# MODULE 2: Asynchronous Judicial Moderation Engine

## ⚖️ USE CASE 2.1: AUDIT PENDING QUEUE ENTRIES
This use case manages the core peer-review pipeline workspace. To ensure maximum narrative neutrality and systemic security, the platform serves verification cards using a strict double-blind protocol where the original contributor's identity is completely masked from the peer reviewer.

### I. Double-Blind Ingestion Routing Contract
* **HTTP Method:** `GET`
* **API Endpoint Path:** `/api/moderation/pending`
* **Content-Type Protocol:** `application/json`

### II. Framework Component Implementations

#### 1. Moderation Rest Controller Layer
```java
package com.politikapp.module2.controller;

import com.politikapp.module2.model.ProfileEditSubmission;
import com.politikapp.module2.service.ModerationService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/moderation/pending")
@CrossOrigin(origins = "*")
public class ModerationQueueController {

    @Autowired
    private ModerationService moderationService;

    @GetMapping
    public ResponseEntity<List<ProfileEditSubmission>> getAnonymizedQueue() {
        List<ProfileEditSubmission> anonymizedQueue = moderationService.getAnonymizedModerationQueue();
        return ResponseEntity.ok(anonymizedQueue);
    }
}
```

#### 2. Service-Layer Identity Masking Implementation
```Java
package com.politikapp.module2.service;

import org.springframework.stereotype.Service;
import com.politikapp.module2.model.ProfileEditSubmission;
import java.util.List;

@Service
public class ModerationService {

    public List<ProfileEditSubmission> getAnonymizedModerationQueue() {
        List<ProfileEditSubmission> rawQueue = database.createQuery(
            "SELECT p FROM ProfileEditSubmission p WHERE p.status = 'JURY_REVIEW'", 
            ProfileEditSubmission.class
        ).getResultList();
        
        for (ProfileEditSubmission record : rawQueue) {
            record.setContributorId(null); 
        }
        
        return rawQueue;
    }
}
```

## 📥 USE CASE 2.2: LOG PEER REVIEW BALLOT & RECALCULATE CONSENSUS
This use case processes anonymous evaluation ballots cast by peer reviewers. It applies the reviewer's active session trust scaling multiplier and evaluates whether community voting thresholds have been crossed to finalize data.

### I. Ingestion Routing Contract
* **HTTP Method:** `POST`
* **API Endpoint Path:** `/api/moderation/vote`
* **Content-Type Protocol:** `application/json`

### **Request Payload Body (DTO):**

```JSON
{
  "queueId": "8f7e6d5c-4b3a-2e1d-0c9b-8a7f6e5d4c3b",
  "peerId": "e5f67a8b-9c0d-1e2f-3a4b-5c6d1b2c3d4e",
  "voteSelection": "AGREE",
  "voteReason": "The whitelisted public link matches the numerical metrics array completely."
}
```

### II. Ballot Transaction Processing Logic
```Java
package com.politikapp.module2.service;

import org.springframework.stereotype.Service;
import com.politikapp.module2.dto.BallotSubmissionPayload;
import com.politikapp.common.model.UserSession;
import com.politikapp.common.exception.HttpResponseException;
import java.util.UUID;

@Service
public class VoteService {

    public void processPeerBallot(BallotSubmissionPayload ballot, UserSession reviewerSession) {
        ModerationQueue queueRow = database.find(ModerationQueue.class, ballot.getQueueId());
        
        if (queueRow == null || !"JURY_REVIEW".equals(queueRow.getQueueStatus())) {
            throw new HttpResponseException(424, "Failed Dependency: Target record is not available for moderation.");
        }
        
        int derivedWeight = reviewerSession.getVoteWeight(); 
        
        JuryVote vote = new JuryVote();
        vote.setQueueId(ballot.getQueueId());
        vote.setPeerId(reviewerSession.getUserId());
        vote.setVoteType(ballot.getVoteSelection()); 
        vote.setVoteWeight(derivedWeight);
        vote.setVoteReason(ballot.getVoteReason());
        database.persist(vote);
        
        calculateConsensusOutcome(ballot.getQueueId());
    }

    private void calculateConsensusOutcome(UUID queueId) {
        long agreeSum = fetchWeightedVoteSum(queueId, "AGREE");
        long disagreeSum = fetchWeightedVoteSum(queueId, "DISAGREE");
        
        ModerationQueue queue = database.find(ModerationQueue.class, queueId);
        ProfileEditSubmission submission = database.find(ProfileEditSubmission.class, queue.getSubmissionId());
        
        // Consensus threshold barrier logic: Finalize if weight delta scales past critical margins
        if (agreeSum >= 10 && (agreeSum >= disagreeSum * 2)) {
            queue.setQueueStatus("PUBLISHED");
            submission.setStatus("PUBLISHED");
        } else if (disagreeSum >= 10 && (disagreeSum >= agreeSum * 2)) {
            queue.setQueueStatus("REJECTED");
            submission.setStatus("REJECTED");
        }
        
        database.merge(queue);
        database.merge(submission);
    }

    private long fetchWeightedVoteSum(UUID queueId, String type) {
        Long sum = database.createQuery(
            "SELECT SUM(j.voteWeight) FROM JuryVote j WHERE j.queueId = :queueId AND j.voteType = :type", Long.class
        ).setParameter("queueId", queueId).setParameter("type", type).getSingleResult();
        return sum != null ? sum : 0L;
    }
}
```

## ⏰ USE CASE 2.3: ESCALATE MODERATION DEADLOCKS
An automated backend process continuously inspects queue timestamps and voting balances. If an item is stuck beyond temporal limits or experiences a perfect tie deadlock, it strips public editing permissions and escalates it to the System Administrator dashboard.

### I. Continuous Hourly Cron Job Daemon Component
```Java
package com.politikapp.module2.scheduler;

import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import com.politikapp.module2.model.ModerationQueue;
import java.util.List;

@Component
public class EscalationSchedulerService {

    @Scheduled(cron = "0 0 * * * *") 
    public void runHourlyEscalationAudit() {
        long activeCurrentTimestamp = System.currentTimeMillis();
        long ageVelocityLimitMilliseconds = 24 * 60 * 60 * 1000; 
        
        List<ModerationQueue> activeQueue = database.createQuery(
            "SELECT m FROM ModerationQueue m WHERE m.queueStatus = 'PENDING' OR m.queueStatus = 'JURY_REVIEW'",
            ModerationQueue.class
        ).getResultList();
        
        for (ModerationQueue entry : activeQueue) {
            boolean triggerVelocityEscalation = (activeCurrentTimestamp - entry.getAssignedAt().getTime()) >= ageVelocityLimitMilliseconds;
            
            long agreeSum = fetchWeightedVoteSum(entry.getQueueId(), "AGREE");
            long disagreeSum = fetchWeightedVoteSum(entry.getQueueId(), "DISAGREE");
            boolean triggerGridlockEscalation = (agreeSum > 0 && agreeSum == disagreeSum); 
            
            if (triggerVelocityEscalation || triggerGridlockEscalation) {
                entry.setQueueStatus("ESCALATED");
                entry.setEscalationFlag(true);
                database.merge(entry);
            }
        }
    }

    private long fetchWeightedVoteSum(UUID queueId, String type) {
        Long sum = database.createQuery(
            "SELECT SUM(j.voteWeight) FROM JuryVote j WHERE j.queueId = :queueId AND j.voteType = :type", Long.class
        ).setParameter("queueId", queueId).setParameter("type", type).getSingleResult();
        return sum != null ? sum : 0L;
    }
}
```

### 🖥️ MODULE 2 FRONTEND COMPONENT STATE LAYOUT
```JavaScript
import React, { useState } from 'react';

const [activeReviewCard, setActiveReviewCard] = useState({
  queue_id: null,               
  submission_id: null,          
  politician_id: null,          
  source_url: '',               
  category_tag: '',             
  action_identifier: '',        
  quantitative_metric: '',      
  impact_summary: '',           
  agree_votes: 0,               
  disagree_votes: 0,            
  flag_for_revision: false      
});
```