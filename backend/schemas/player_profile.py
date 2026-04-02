from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field, model_validator


_ROLE_BATSMAN = {"BATSMAN"}
_ROLE_BOWLER = {"BOWLER"}
_ROLE_ALL_ROUNDER = {"ALL-ROUNDER", "ALL ROUNDER", "ALLROUNDER"}
_ROLE_WICKETKEEPER = {"WICKETKEEPER", "WICKET KEEPER", "KEEPER"}
_INVALID_PLACEHOLDERS = {"", "NONE", "NULL", "N/A", "NA", "SELECT OPTION"}


def _clean_text(value: Optional[str]) -> str:
    return (value or "").strip()


def _is_missing_text(value: Optional[str]) -> bool:
    return _clean_text(value).upper() in _INVALID_PLACEHOLDERS


def _normalized_role(value: Optional[str]) -> str:
    return _clean_text(value).upper()


class PlayerProfileUpdateRequest(BaseModel):
    fullName: str = Field(default="")
    username: str = Field(default="")
    age: Optional[int] = None
    gender: str = Field(default="")
    city: str = Field(default="")
    state: str = Field(default="")
    country: str = Field(default="")
    cricketRole: str = Field(default="")
    experienceLevel: str = Field(default="")
    battingHand: str = Field(default="")
    bowlingArm: str = Field(default="")
    bowlingType: str = Field(default="")
    preferredFormat: str = Field(default="")
    bio: str = Field(default="")
    profilePhoto: str = Field(default="")
    educationType: str = Field(default="")
    institutionName: str = Field(default="")
    hasCricketClub: Optional[bool] = None
    cricketClubName: str = Field(default="")

    model_config = ConfigDict(extra="ignore")

    @model_validator(mode="after")
    def validate_business_rules(self) -> "PlayerProfileUpdateRequest":
        errors: list[str] = []
        role = _normalized_role(self.cricketRole)

        if _is_missing_text(self.gender):
            errors.append("gender is required")

        if _is_missing_text(self.educationType):
            errors.append("educationType is required")
        elif _is_missing_text(self.institutionName):
            errors.append("institutionName is required when educationType is selected")

        if self.hasCricketClub is True and _is_missing_text(self.cricketClubName):
            errors.append("cricketClubName is required when hasCricketClub is true")

        if role in _ROLE_BATSMAN or role in _ROLE_WICKETKEEPER:
            if _is_missing_text(self.battingHand):
                errors.append("battingHand is required for the selected cricketRole")
        elif role in _ROLE_BOWLER:
            if _is_missing_text(self.bowlingArm):
                errors.append("bowlingArm is required for the selected cricketRole")
            if _is_missing_text(self.bowlingType):
                errors.append("bowlingType is required for the selected cricketRole")
        elif role in _ROLE_ALL_ROUNDER:
            if _is_missing_text(self.battingHand):
                errors.append("battingHand is required for the selected cricketRole")
            if _is_missing_text(self.bowlingArm):
                errors.append("bowlingArm is required for the selected cricketRole")
            if _is_missing_text(self.bowlingType):
                errors.append("bowlingType is required for the selected cricketRole")

        if errors:
            raise ValueError("; ".join(errors))

        return self


class PlayerProfileResponse(BaseModel):
    id: str
    userId: str
    email: str
    username: str
    fullName: str
    age: Optional[int]
    gender: str
    city: str
    state: str
    country: str
    cricketRole: str
    experienceLevel: str
    battingHand: str
    bowlingArm: str
    bowlingType: str
    preferredFormat: str
    bio: str
    profilePhoto: str
    educationType: str
    institutionName: str
    hasCricketClub: Optional[bool]
    cricketClubName: str
    verified: bool
    matches: int
    highlights: int
    currentLevel: str
    completionPercentage: int
    profileCompleted: bool
    missingFields: List[str]
    createdAt: Optional[datetime]
    updatedAt: Optional[datetime]


class PlayerProfileEnvelope(BaseModel):
    success: bool = True
    profile: PlayerProfileResponse
    completion_percentage: int = 0
    missing_fields: List[str] = Field(default_factory=list)
    fields_left: int = 0
    profile_status: str = "incomplete"


class PlayerProfileUpdateEnvelope(PlayerProfileEnvelope):
    message: str = "Profile updated successfully"
