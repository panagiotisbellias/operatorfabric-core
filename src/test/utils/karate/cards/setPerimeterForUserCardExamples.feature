Feature: Add perimeters/group for action test 

  Background:
   #Getting token for admin and tso1-operator user calling getToken.feature
    * def signIn = call read('../common/getToken.feature') { username: 'admin'}
    * def authToken = signIn.authToken



    * def perimeterUserCardExamples =
"""
{
  "id" : "perimeterUserCardExamples",
  "process" : "userCardExamples",
  "stateRights" : [
    {
      "state" : "messageState",
      "right" : "ReceiveAndWrite"
    },
    {
      "state" : "conferenceState",
      "right" : "ReceiveAndWrite"
    }
  ]
}
"""

  Scenario: Create perimeterUserCardExamples
    Given url opfabUrl + 'users/perimeters'
    And header Authorization = 'Bearer ' + authToken
    And request perimeterUserCardExamples
    When method post
    Then status 201


  Scenario: Add perimeterQuestion for groups TSO1
    Given url opfabUrl + 'users/groups/TSO1/perimeters'
    And header Authorization = 'Bearer ' + authToken
    And request ["perimeterUserCardExamples"]
    When method patch
    Then status 200

  Scenario: Add perimeterQuestion for groups TSO2
    Given url opfabUrl + 'users/groups/TSO2/perimeters'
    And header Authorization = 'Bearer ' + authToken
    And request ["perimeterUserCardExamples"]
    When method patch
    Then status 200
