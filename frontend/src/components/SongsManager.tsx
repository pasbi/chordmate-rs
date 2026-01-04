import React, { useEffect, useState } from "react";
import Song from "types/Song";
import { useMutation, useQuery } from "@apollo/client/react";
import { gql } from "@apollo/client";
import SongForm from "components/SongForm";
import SongsList from "components/SongsList";
import GetSongsData from "types/GetSongsData";

export default function SongsManager() {
  return (
    <div>
      <SongForm />
      <SongsList />
    </div>
  );
}
