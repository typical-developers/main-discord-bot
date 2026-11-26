package common

// Experience is a Roblox experience shown in the bot's status.
type Experience struct {
	Name       string
	UniverseID int64
}

// StatusExperiences are cycled through in the bot's status, in order.
var StatusExperiences = []Experience{
	{Name: "Oaklands", UniverseID: 3666294218},
	{Name: "Voxel Block Builder", UniverseID: 8006379851},
	{Name: "Build With Blocks", UniverseID: 8827949529},
}
