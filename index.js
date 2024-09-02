const fs = require("fs");
const data = fs.readFileSync("groups.json", "utf8");
const groups = JSON.parse(data);

const exhibitionData = fs.readFileSync("exibitions.json", "utf8");
const exhibitions = JSON.parse(exhibitionData);

const groupsExpanded = {};

const qualifiedTeams = {
  firstPlace: [],
  secondPlace: [],
  thirdPlace: [],
};

Object.keys(groups).forEach((groupName) => {
  const teamsInGroup = groups[groupName];

  groupsExpanded[groupName] = teamsInGroup.map((team) => ({
    teamName: team.Team,
    groupName: groupName,
    ISOCode: team.ISOCode,
    FIBARanking: team.FIBARanking,
    totalPointsScored: 0,
    totalPointsReceived: 0,
    totalPointsDifference: 0,
    totalRankingPoints: 0,
    wins: 0,
    losses: 0,
    results: [],
  }));
});

Object.keys(exhibitions).forEach((countryCode) => {
  const currentTeamArr = exhibitions[countryCode];

  // Find the team's object in the groupsExpanded
  let teamObject;
  Object.keys(groupsExpanded).forEach((groupName) => {
    const teamInGroup = groupsExpanded[groupName].find(
      (team) => team.ISOCode === countryCode
    );
    if (teamInGroup) {
      teamObject = teamInGroup;
    }
  });

  if (teamObject) {
    // Starting assumption is that the team's form will be calculated based on the last 2 games
    teamObject.lastTwoGames = currentTeamArr.map((match) => {
      const opponentISOCode = Object.keys(groupsExpanded)
        .flatMap((groupName) => groupsExpanded[groupName])
        .find((team) => team.ISOCode === match.Opponent)?.ISOCode;

      let opponentRanking = null;

      if (opponentISOCode) {
        Object.keys(groupsExpanded).forEach((groupName) => {
          const foundTeam = groupsExpanded[groupName].find(
            (team) => team.ISOCode === opponentISOCode
          );
          if (foundTeam) {
            opponentRanking = foundTeam.FIBARanking;
          }
        });
      }

      return {
        outcome:
          match.Result.split("-")[0] > match.Result.split("-")[1]
            ? "win"
            : "lose",
        pointsDifferenceInGame:
          parseInt(match.Result.split("-")[0]) -
          parseInt(match.Result.split("-")[1]),
        opponentRanking: opponentRanking,
      };
    });
  }
});

function simulateGroupStage() {
  Object.keys(groupsExpanded).forEach((groupName) => {
    const teamsInGroup = groupsExpanded[groupName];

    console.log(`Rezultati grupe ${groupName}:`);

    for (let i = 0; i < teamsInGroup.length; i++) {
      for (let j = i + 1; j < teamsInGroup.length; j++) {
        const result = simulateMatch(
          teamsInGroup[i],
          teamsInGroup[j],
          groupName
        );
      }
    }

    // Rank teams once all of them played against each other
    rankTeams(groupName);
  });

  // Rank teams for the knockout stage
  const {
    rankedFirstPlaceTeams,
    rankedSecondPlaceTeams,
    rankedThirdPlaceTeams,
  } = rankTeamsForKnockoutStage();

  const overallRanking = [
    ...rankedFirstPlaceTeams,
    ...rankedSecondPlaceTeams,
    ...rankedThirdPlaceTeams,
  ];

  overallRanking.forEach((team, index) => {
    team.overallRanking = index + 1;
  });

  const advancingTeams = overallRanking.slice(0, 8);
  // Timovi koji su prosli grupnu fazu
  console.log(
    "Timovi koji prolaze u nokaut fazu rangirani po ostvarenom rezultatu:"
  );
  advancingTeams.forEach((advTeam) => {
    console.log(`${advTeam.overallRanking}. mesto: ${advTeam.teamName}`);
  });
  const eliminatedTeam = overallRanking[8]; // if needed

  return advancingTeams;
}

function calculateForm(lastTwoGames) {
  let formFactor = 1;

  lastTwoGames.forEach((game) => {
    if (game.outcome === "win") {
      formFactor += 0.1;
    } else {
      formFactor -= 0.1;
    }

    formFactor += game.pointsDifferenceInGame * 0.01;

    // Postavio sam ovaj uslov jer u "exibitions.json", Brazil je odigrao mec sa ekipom ciji je property "Opponent": "POR", a taj kod ne postoji medju ISOCode-ovima u "groups.json"
    if (game.opponentRanking) {
      if (game.opponentRanking < 5) {
        // beating higher ranked team is more significant
        formFactor += 0.01;
      } else {
        // beating lower ranked team is less significant
        formFactor += 0.05;
      }
    }
  });

  return formFactor;
}

function simulateMatch(team1, team2, group, isGroupMatch = true) {
  const rankingDifference = team1.FIBARanking - team2.FIBARanking;
  const formFactorTeam1 = calculateForm(team1.lastTwoGames);
  const formFactorTeam2 = calculateForm(team2.lastTwoGames);
  let scoreTeam1, scoreTeam2;

  if (Math.abs(rankingDifference) < 5) {
    // Close match
    scoreTeam1 = (70 + Math.floor(Math.random() * 10)) * formFactorTeam1;
    scoreTeam2 = (70 + Math.floor(Math.random() * 10)) * formFactorTeam2;
  } else if (
    Math.abs(rankingDifference) >= 5 &&
    Math.abs(rankingDifference) <= 10
  ) {
    // Decent point difference: ranking difference between 5 and 10
    if (rankingDifference > 0) {
      // team2 is better
      scoreTeam2 = (75 + Math.floor(Math.random() * 15)) * formFactorTeam2;
      scoreTeam1 = (65 + Math.floor(Math.random() * 15)) * formFactorTeam1;
    } else {
      //team1 is better
      scoreTeam1 = (75 + Math.floor(Math.random() * 15)) * formFactorTeam1;
      scoreTeam2 = (65 + Math.floor(Math.random() * 15)) * formFactorTeam2;
    }
  } else {
    // Dominant win: ranking difference is more than 10
    if (rankingDifference > 0) {
      // team2 is better
      scoreTeam2 = (80 + Math.floor(Math.random() * 20)) * formFactorTeam2;
      scoreTeam1 = (60 + Math.floor(Math.random() * 20)) * formFactorTeam1;
    } else {
      //team1 is better
      scoreTeam1 = (80 + Math.floor(Math.random() * 20)) * formFactorTeam1;
      scoreTeam2 = (60 + Math.floor(Math.random() * 20)) * formFactorTeam2;
    }
  }

  // If the result is draw, add +1 to the better ranked team
  if (
    Math.floor(scoreTeam1) === Math.floor(scoreTeam2) &&
    rankingDifference > 0
  )
    scoreTeam2++;
  if (
    Math.floor(scoreTeam1) === Math.floor(scoreTeam2) &&
    rankingDifference < 0
  )
    scoreTeam1++;

  if (isGroupMatch) {
    // RESENJE - PRIKAZATI REZULTATE PO GRUPAMA
    console.log(
      `${team1.teamName} - ${team2.teamName} (${Math.floor(
        scoreTeam1
      )} : ${Math.floor(scoreTeam2)})`
    );

    // Update team stats for group matches
    updateTeamStats(
      group,
      team1.teamName,
      Math.floor(scoreTeam1),
      team2.teamName,
      Math.floor(scoreTeam2)
      // team2.FIBARanking
    );
    updateTeamStats(
      group,
      team2.teamName,
      Math.floor(scoreTeam2),
      team1.teamName,
      Math.floor(scoreTeam1)
      // team1.FIBARanking
    );
  } else {
    return {
      team1,
      scoreTeam1: Math.floor(scoreTeam1),
      team2,
      scoreTeam2: Math.floor(scoreTeam2),
    };
  }
}

function updateTeamStats(
  group,
  teamName,
  pointsScored,
  opponent,
  pointsReceived
) {
  // Find the exact team
  const team = groupsExpanded[group].find((t) => t.teamName === teamName);

  // Update team stats
  if (team) {
    team.totalPointsScored += pointsScored;
    team.totalPointsReceived += pointsReceived;
    team.totalPointsDifference =
      team.totalPointsScored - team.totalPointsReceived;
    team.results.push({
      opponent,
      pointsScored,
      pointsReceived,
      pointsDifferenceInMatch: pointsScored - pointsReceived,
    });

    if (pointsScored > pointsReceived) {
      team.wins++;
      team.totalRankingPoints += 2;
    } else {
      team.losses++;
      team.totalRankingPoints += 1;
    }
  }
}

function rankTeams(group) {
  const groupName = groupsExpanded[group];
  const sortedGroup = groupName.sort((a, b) => {
    // Compare total ranking points first
    if (b.totalRankingPoints !== a.totalRankingPoints) {
      return b.totalRankingPoints - a.totalRankingPoints;
    } else {
      let pointsDifference = 0;
      // If total ranking points are the same, compare the head-to-head result
      const matchBetweenTeamsBAndA = b.results.find(
        (opponentObj) => opponentObj.opponent === a.teamName
      );
      const matchBetweenTeamsAAndB = a.results.find(
        (opponentObj) => opponentObj.opponent === b.teamName
      );

      if (matchBetweenTeamsBAndA && matchBetweenTeamsAAndB) {
        pointsDifference =
          matchBetweenTeamsBAndA.pointsDifferenceInMatch -
          matchBetweenTeamsAAndB.pointsDifferenceInMatch;
      }

      if (pointsDifference !== 0) {
        return pointsDifference; // If the point difference is not zero, use it to sort
      }
    }
  });

  // Konacan plasman po grupama
  console.log(`Grupa ${group}:`);
  sortedGroup.forEach((team, index) => {
    console.log(
      `${index + 1}. ${team.teamName} - ${team.wins} pobede / ${
        team.losses
      } poraza / ${team.totalRankingPoints} bodova / ${
        team.totalPointsScored
      } postignutih koseva / ${team.totalPointsReceived} primljenih koseva / ${
        team.totalPointsDifference
      } kos razlika`
    );
  });
}

function rankTeamsAcrossGroups(teams) {
  return teams.sort((a, b) => {
    if (b.totalRankingPoints !== a.totalRankingPoints) {
      return b.totalRankingPoints - a.totalRankingPoints;
    } else if (b.totalPointsDifference !== a.totalPointsDifference) {
      return b.totalPointsDifference - a.totalPointsDifference;
    } else {
      return b.totalPointsScored - a.totalPointsScored;
    }
  });
}

function rankTeamsForKnockoutStage() {
  Object.keys(groupsExpanded).forEach((groupName) => {
    const group = groupsExpanded[groupName];

    qualifiedTeams.firstPlace.push(group[0]);
    qualifiedTeams.secondPlace.push(group[1]);
    qualifiedTeams.thirdPlace.push(group[2]);
  });

  const rankedFirstPlaceTeams = rankTeamsAcrossGroups(
    qualifiedTeams.firstPlace
  );
  const rankedSecondPlaceTeams = rankTeamsAcrossGroups(
    qualifiedTeams.secondPlace
  );
  const rankedThirdPlaceTeams = rankTeamsAcrossGroups(
    qualifiedTeams.thirdPlace
  );

  return {
    rankedFirstPlaceTeams,
    rankedSecondPlaceTeams,
    rankedThirdPlaceTeams,
  };
}

const advancingTeams = simulateGroupStage();
simulateKnockoutStage(advancingTeams);

function createPots(teams) {
  const pots = {
    D: teams.slice(0, 2),
    E: teams.slice(2, 4),
    F: teams.slice(4, 6),
    G: teams.slice(6, 8),
  };

  return pots;
}

function simulateKnockoutStage(advancingTeams) {
  // Creating pots for the knockout stage
  const pots = createPots(advancingTeams);

  console.log("Sesiri:");
  Object.keys(pots).forEach((pot) => {
    console.log(`Sesir ${pot}: `, pots[pot][0].teamName, pots[pot][1].teamName);
  });

  // Draw and simulate quarterfinal matches
  const quarterfinalsMatches = generateQuarterfinals(pots);
  const quarterfinalsWinners = simulateQuarterfinals(quarterfinalsMatches);

  // Simulate semifinal matches
  const { semifinalWinners, semifinalLosers } =
    simulateSemifinals(quarterfinalsWinners);

  // Simulate final and third place match
  simulateFinals(semifinalWinners, semifinalLosers);
}

function generateQuarterfinals(pots) {
  const quarterfinals = [];

  // Pair pot D with pot G
  for (let i = 0; i < pots.D.length; i++) {
    const teamFromD = pots.D[i];
    let opponentFromG = pots.G.find(
      (team) => team.groupName !== teamFromD.groupName
    );

    // If both teams from the pot G were in the same group as "teamFromD", then the opponent will be randomly assigned, ensuring the "teamFromD" still has an opponent
    if (!opponentFromG) {
      // randomly return the last element of the "G" array
      opponentFromG = pots.G.pop();
    } else {
      // Ensuring the same team "opponentFromG" is not assigned as the opponent to the "teamFromD" in the following iteration
      pots.G = pots.G.filter((team) => team !== opponentFromG);
    }

    quarterfinals.push([teamFromD, opponentFromG]);
  }

  // Pair pot E with pot F
  for (let i = 0; i < pots.E.length; i++) {
    const teamFromE = pots.E[i];
    let opponentFromF = pots.F.find(
      (team) => team.groupName !== teamFromE.groupName
    );

    if (!opponentFromF) {
      opponentFromF = pots.F.pop();
    } else {
      pots.F = pots.F.filter((team) => team !== opponentFromF);
    }

    quarterfinals.push([teamFromE, opponentFromF]);
  }

  return quarterfinals;
}

function simulateQuarterfinals(quarterfinalsMatches) {
  const quarterfinalWinners = [];

  quarterfinalsMatches.forEach((pair, index) => {
    const team1 = pair[0];
    const team2 = pair[1];

    const matchResult = simulateMatch(team1, team2, null, false);

    console.log(
      `${index + 1}. utakmica cetvrtfinala: ${matchResult.team1.teamName} - ${
        matchResult.team2.teamName
      } (${matchResult.scoreTeam1}:${matchResult.scoreTeam2}) `
    );

    const winner =
      matchResult.scoreTeam1 > matchResult.scoreTeam2
        ? matchResult.team1
        : matchResult.team2;
    quarterfinalWinners.push(winner);
  });

  return quarterfinalWinners;
}

function simulateSemifinals(quarterfinalsWinners) {
  // Draw semifinal pairs
  const semifinalMatches = [
    [quarterfinalsWinners[0], quarterfinalsWinners[2]],
    [quarterfinalsWinners[1], quarterfinalsWinners[3]],
  ];

  const semifinalWinners = [];
  const semifinalLosers = [];

  semifinalMatches.forEach((pair, index) => {
    const team1 = pair[0];
    const team2 = pair[1];

    const matchResult = simulateMatch(team1, team2, null, false);

    const winner =
      matchResult.scoreTeam1 > matchResult.scoreTeam2 ? team1 : team2;
    const loser =
      matchResult.scoreTeam1 > matchResult.scoreTeam2 ? team2 : team1;

    semifinalWinners.push(winner);
    semifinalLosers.push(loser);

    console.log(
      `Rezultat ${index + 1}. polufinala: ${matchResult.team1.teamName} - ${
        matchResult.team2.teamName
      } (${matchResult.scoreTeam1}:${matchResult.scoreTeam2})`
    );
  });

  return { semifinalWinners, semifinalLosers };
}

function simulateFinals(semifinalWinners, semifinalLosers) {
  // Simulate the final match
  const finalMatchResult = simulateMatch(
    semifinalWinners[0],
    semifinalWinners[1],
    null,
    false
  );
  const champion =
    finalMatchResult.scoreTeam1 > finalMatchResult.scoreTeam2
      ? finalMatchResult.team1
      : finalMatchResult.team2;
  const runnerUp =
    finalMatchResult.scoreTeam1 > finalMatchResult.scoreTeam2
      ? finalMatchResult.team2
      : finalMatchResult.team1;

  console.log(
    `Rezultat finala: ${finalMatchResult.team1.teamName} - ${finalMatchResult.team2.teamName} (${finalMatchResult.scoreTeam1}:${finalMatchResult.scoreTeam2})`
  );

  // Simulate the third-place match
  const thirdPlaceMatchResult = simulateMatch(
    semifinalLosers[0],
    semifinalLosers[1],
    null,
    false
  );
  const thirdPlace =
    thirdPlaceMatchResult.scoreTeam1 > thirdPlaceMatchResult.scoreTeam2
      ? thirdPlaceMatchResult.team1
      : thirdPlaceMatchResult.team2;

  console.log(
    `Rezultat utakmice za trece mesto: ${thirdPlaceMatchResult.team1.teamName} - ${thirdPlaceMatchResult.team2.teamName} (${thirdPlaceMatchResult.scoreTeam1}:${thirdPlaceMatchResult.scoreTeam2})`
  );

  console.log(`Zlatna medalja: ${champion.teamName}`);
  console.log(`Srebrna medalja: ${runnerUp.teamName}`);
  console.log(`Bronzana medalja: ${thirdPlace.teamName}`);
}
